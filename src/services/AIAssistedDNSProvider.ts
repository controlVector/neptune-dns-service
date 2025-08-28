/**
 * AI-Assisted DNS Provider - Uses LLM intelligence to solve DNS configuration problems
 * This provider can call an AI agent when it encounters issues, learning from each interaction
 */

import axios, { AxiosInstance } from 'axios'
import { DNSProvider, DNSRecordResult, DNSProviderError } from './DNSProvider'

interface AIContext {
  attempts: Array<{
    action: string
    request: any
    response: any
    success: boolean
    timestamp: Date
  }>
  knownFacts: {
    apiToken?: string
    accountId?: string
    zoneId?: string
    domain?: string
    workingCurlCommands?: string[]
  }
}

export class AIAssistedDNSProvider implements DNSProvider {
  name = 'cloudflare-ai-assisted'
  private client: AxiosInstance
  private context: AIContext
  private llmEndpoint: string

  constructor(
    private apiToken: string,
    options: {
      llmEndpoint?: string
      accountId?: string
      zoneId?: string
    } = {}
  ) {
    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/client/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    this.llmEndpoint = options.llmEndpoint || process.env.LLM_ENDPOINT || 'http://localhost:3003/api/v1/watson/assist'
    
    this.context = {
      attempts: [],
      knownFacts: {
        apiToken: apiToken.substring(0, 10) + '...',
        accountId: options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID,
        zoneId: options.zoneId || process.env.CLOUDFLARE_ZONE_ID
      }
    }
  }

  /**
   * Call AI agent for assistance when stuck
   */
  private async askAIForHelp(problem: string): Promise<any> {
    console.log(`[AI-DNS] Asking AI for help with: ${problem}`)
    
    const prompt = `
You are helping Neptune DNS service configure Cloudflare DNS records. 
The service has encountered an issue and needs your help.

Problem: ${problem}

Context of previous attempts:
${JSON.stringify(this.context.attempts.slice(-3), null, 2)}

Known facts:
- API Token starts with: ${this.context.knownFacts.apiToken}
- Account ID: ${this.context.knownFacts.accountId || 'Unknown'}
- Zone ID: ${this.context.knownFacts.zoneId || 'Unknown'}
- Domain: ${this.context.knownFacts.domain || 'Unknown'}

Previously working curl commands (if any):
${this.context.knownFacts.workingCurlCommands?.join('\n') || 'None'}

Please provide:
1. The exact API endpoint to use
2. Any required headers
3. The request body if needed
4. Alternative approaches if the first one fails

Format your response as JSON with:
{
  "strategy": "description of approach",
  "endpoint": "the API endpoint",
  "method": "GET/POST/PUT/DELETE",
  "headers": {},
  "body": {},
  "alternativeApproaches": ["approach1", "approach2"],
  "explanation": "why this should work"
}
`

    try {
      // In a real implementation, this would call Watson or another AI service
      // For now, let's simulate what an AI would suggest based on our learning
      const response = await this.simulateAIResponse(problem)
      
      console.log(`[AI-DNS] AI suggested: ${response.strategy}`)
      return response
    } catch (error) {
      console.error(`[AI-DNS] Failed to get AI help:`, error)
      return null
    }
  }

  /**
   * Simulate AI response based on common patterns
   * In production, this would actually call Watson/Claude
   */
  private async simulateAIResponse(problem: string): Promise<any> {
    // Pattern recognition based on the problem
    if (problem.includes('zone') || problem.includes('404')) {
      return {
        strategy: "Use the zone ID directly without verification",
        endpoint: `/zones/${this.context.knownFacts.zoneId}/dns_records`,
        method: "GET",
        headers: {},
        body: null,
        alternativeApproaches: [
          "List all zones without filtering",
          "Use account-specific endpoint",
          "Try with just the API token"
        ],
        explanation: "Account API tokens sometimes can't verify zones directly but can still manage DNS records"
      }
    }
    
    if (problem.includes('create record')) {
      return {
        strategy: "Create DNS record using known zone ID",
        endpoint: `/zones/${this.context.knownFacts.zoneId}/dns_records`,
        method: "POST",
        headers: {},
        body: {
          type: "A",
          name: "@",
          content: "0.0.0.0",
          ttl: 3600,
          proxied: false
        },
        alternativeApproaches: [
          "Try with full domain name instead of @",
          "Use lower TTL value",
          "Disable proxying"
        ],
        explanation: "Direct record creation often works even when zone listing fails"
      }
    }

    return {
      strategy: "Fallback to direct API call",
      endpoint: "/zones",
      method: "GET",
      headers: {},
      body: null,
      alternativeApproaches: ["Check API token permissions", "Verify account ID"],
      explanation: "Starting with basic zone listing to understand permissions"
    }
  }

  /**
   * Execute API call with AI assistance on failure
   */
  private async executeWithAI(
    operation: string,
    apiCall: () => Promise<any>
  ): Promise<any> {
    const attempt = {
      action: operation,
      request: null as any,
      response: null as any,
      success: false,
      timestamp: new Date()
    }

    try {
      console.log(`[AI-DNS] Attempting: ${operation}`)
      const result = await apiCall()
      
      attempt.success = true
      attempt.response = result.data || result
      this.context.attempts.push(attempt)
      
      console.log(`[AI-DNS] Success: ${operation}`)
      return result
    } catch (error: any) {
      attempt.response = error.response?.data || error.message
      this.context.attempts.push(attempt)
      
      console.log(`[AI-DNS] Failed: ${operation}, asking AI for help`)
      
      // Ask AI for help
      const aiSuggestion = await this.askAIForHelp(
        `Failed to ${operation}. Error: ${error.message}, Status: ${error.response?.status}`
      )
      
      if (aiSuggestion) {
        // Try the AI's suggestion
        try {
          console.log(`[AI-DNS] Trying AI suggestion: ${aiSuggestion.strategy}`)
          
          const aiResponse = await this.client.request({
            method: aiSuggestion.method,
            url: aiSuggestion.endpoint,
            headers: aiSuggestion.headers,
            data: aiSuggestion.body
          })
          
          console.log(`[AI-DNS] AI suggestion worked!`)
          
          // Record the successful approach
          this.recordSuccess(operation, aiSuggestion)
          
          return aiResponse
        } catch (aiError: any) {
          console.log(`[AI-DNS] AI suggestion failed too, trying alternatives`)
          
          // Try alternative approaches
          if (aiSuggestion.alternativeApproaches) {
            for (const approach of aiSuggestion.alternativeApproaches) {
              console.log(`[AI-DNS] Trying alternative: ${approach}`)
              // In a real implementation, each alternative would be properly executed
            }
          }
        }
      }
      
      throw error
    }
  }

  /**
   * Record successful API patterns for future use
   */
  private recordSuccess(operation: string, approach: any) {
    const curlCommand = this.generateCurlCommand(approach)
    if (!this.context.knownFacts.workingCurlCommands) {
      this.context.knownFacts.workingCurlCommands = []
    }
    this.context.knownFacts.workingCurlCommands.push(curlCommand)
    
    console.log(`[AI-DNS] Recorded working approach for ${operation}`)
    console.log(`[AI-DNS] Curl: ${curlCommand}`)
  }

  private generateCurlCommand(approach: any): string {
    const headers = Object.entries(approach.headers || {})
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' ')
    
    const data = approach.body ? `-d '${JSON.stringify(approach.body)}'` : ''
    
    return `curl -X ${approach.method} "https://api.cloudflare.com/client/v4${approach.endpoint}" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" ${data}`
  }

  async createRecord(domain: string, record: Omit<DNSRecordResult, 'id'>): Promise<DNSRecordResult> {
    this.context.knownFacts.domain = domain

    return this.executeWithAI(
      `create ${record.type} record for ${domain}`,
      async () => {
        // First try the standard approach
        const zoneId = this.context.knownFacts.zoneId
        if (!zoneId) {
          throw new Error('No zone ID available')
        }

        const fullName = record.name === '@' ? domain : 
                        record.name.includes(domain) ? record.name : 
                        `${record.name}.${domain}`

        const response = await this.client.post(`/zones/${zoneId}/dns_records`, {
          type: record.type,
          name: fullName,
          content: record.data,
          ttl: record.ttl || 3600,
          priority: record.priority,
          proxied: false
        })

        if (!response.data.success) {
          throw new Error(response.data.errors?.[0]?.message || 'Failed to create record')
        }

        const cfRecord = response.data.result
        return {
          id: cfRecord.id,
          type: cfRecord.type,
          name: cfRecord.name,
          data: cfRecord.content,
          ttl: cfRecord.ttl,
          priority: cfRecord.priority
        }
      }
    )
  }

  async updateRecord(domain: string, recordId: string, record: Partial<DNSRecordResult>): Promise<DNSRecordResult> {
    return this.executeWithAI(
      `update record ${recordId}`,
      async () => {
        const zoneId = this.context.knownFacts.zoneId
        if (!zoneId) {
          throw new Error('No zone ID available')
        }

        const updateData: any = {}
        if (record.name !== undefined) updateData.name = record.name
        if (record.data !== undefined) updateData.content = record.data
        if (record.ttl !== undefined) updateData.ttl = record.ttl
        if (record.priority !== undefined) updateData.priority = record.priority

        const response = await this.client.patch(`/zones/${zoneId}/dns_records/${recordId}`, updateData)

        if (!response.data.success) {
          throw new Error(response.data.errors?.[0]?.message || 'Failed to update record')
        }

        const cfRecord = response.data.result
        return {
          id: cfRecord.id,
          type: cfRecord.type,
          name: cfRecord.name,
          data: cfRecord.content,
          ttl: cfRecord.ttl,
          priority: cfRecord.priority
        }
      }
    )
  }

  async deleteRecord(domain: string, recordId: string): Promise<void> {
    await this.executeWithAI(
      `delete record ${recordId}`,
      async () => {
        const zoneId = this.context.knownFacts.zoneId
        if (!zoneId) {
          throw new Error('No zone ID available')
        }

        const response = await this.client.delete(`/zones/${zoneId}/dns_records/${recordId}`)

        if (!response.data.success) {
          throw new Error(response.data.errors?.[0]?.message || 'Failed to delete record')
        }
      }
    )
  }

  async listRecords(domain: string, type?: string): Promise<DNSRecordResult[]> {
    return this.executeWithAI(
      `list ${type || 'all'} records for ${domain}`,
      async () => {
        const zoneId = this.context.knownFacts.zoneId
        if (!zoneId) {
          // This is where AI would help us discover the zone ID
          throw new Error('No zone ID available - need AI assistance')
        }

        const params: any = { per_page: 100 }
        if (type) params.type = type

        const response = await this.client.get(`/zones/${zoneId}/dns_records`, { params })

        if (!response.data.success) {
          throw new Error(response.data.errors?.[0]?.message || 'Failed to list records')
        }

        return response.data.result.map((cfRecord: any) => ({
          id: cfRecord.id,
          type: cfRecord.type,
          name: cfRecord.name,
          data: cfRecord.content,
          ttl: cfRecord.ttl,
          priority: cfRecord.priority
        }))
      }
    )
  }

  async verifyDomainOwnership(domain: string): Promise<boolean> {
    try {
      await this.listRecords(domain)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Learn from successful manual interventions
   */
  async learnFromCurlCommand(curlCommand: string, wasSuccessful: boolean) {
    if (wasSuccessful) {
      if (!this.context.knownFacts.workingCurlCommands) {
        this.context.knownFacts.workingCurlCommands = []
      }
      this.context.knownFacts.workingCurlCommands.push(curlCommand)
      
      console.log(`[AI-DNS] Learned from successful curl command`)
      
      // Parse the curl command to understand what worked
      // This would extract endpoint, method, headers, etc.
      // And use that knowledge in future attempts
    }
  }
}