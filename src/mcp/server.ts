/**
 * MCP (Model Context Protocol) Server for Neptune DNS Management Agent
 */

import { 
  NEPTUNE_MCP_TOOLS, 
  validateMCPToolInput, 
  createMCPResult,
  MCPToolResult,
  CreateDNSRecordSchema,
  UpdateDNSRecordSchema,
  DeleteDNSRecordSchema,
  ListDNSRecordsSchema,
  VerifyDNSPropagationSchema,
  ConfigureDomainSSLSchema,
  ExecuteDomainSetupSchema,
  ExecuteSSLSetupSchema,
  ExecuteDomainVerificationSchema
} from './tools'
import { DNSService } from '../services/DNSService'

export class NeptuneMCPServer {
  private dnsService: DNSService
  
  constructor() {
    this.dnsService = new DNSService()
  }

  /**
   * Get list of available MCP tools
   */
  getAvailableTools() {
    return {
      tools: NEPTUNE_MCP_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    }
  }

  /**
   * Execute an MCP tool call
   */
  async callTool(toolName: string, input: unknown): Promise<MCPToolResult> {
    try {
      switch (toolName) {
        case 'neptune_create_dns_record':
          return await this.createDNSRecord(input)
        
        case 'neptune_update_dns_record':
          return await this.updateDNSRecord(input)
        
        case 'neptune_delete_dns_record':
          return await this.deleteDNSRecord(input)
        
        case 'neptune_list_dns_records':
          return await this.listDNSRecords(input)
        
        case 'neptune_verify_dns_propagation':
          return await this.verifyDNSPropagation(input)
        
        case 'neptune_configure_domain_ssl':
          return await this.configureDomainSSL(input)
        
        // EXECUTABLE DOMAIN SETUP TOOLS
        case 'neptune_execute_domain_setup':
          return await this.executeDomainSetup(input)
        
        case 'neptune_execute_ssl_setup':
          return await this.executeSSLSetup(input)
        
        case 'neptune_execute_domain_verification':
          return await this.executeDomainVerification(input)
        
        default:
          return createMCPResult(`Unknown tool: ${toolName}`, true)
      }
    } catch (error) {
      console.error(`MCP tool error (${toolName}):`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      return createMCPResult(`Tool execution failed: ${errorMessage}`, true)
    }
  }

  /**
   * MCP Tool: Create DNS Record
   */
  private async createDNSRecord(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_create_dns_record')!
    const params = validateMCPToolInput<typeof CreateDNSRecordSchema._type>(tool, input)

    try {
      const result = await this.dnsService.createRecord(
        params.domain,
        params.record_type,
        params.name,
        params.content,
        params.provider,
        params.jwt_token,
        { ttl: params.ttl, priority: undefined }
      )

      return createMCPResult(
        `✅ DNS Record Created Successfully:\n` +
        `Record ID: ${result.id}\n` +
        `Domain: ${params.domain}\n` +
        `Type: ${result.type}\n` +
        `Name: ${result.name}\n` +
        `Content: ${result.data}\n` +
        `Provider: ${params.provider}\n` +
        `TTL: ${result.ttl} seconds\n` +
        `Status: Record created and active\n` +
        `Note: DNS propagation may take 5-10 minutes`
      )
    } catch (error) {
      return createMCPResult(`❌ DNS record creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  /**
   * MCP Tool: Update DNS Record
   */
  private async updateDNSRecord(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_update_dns_record')!
    const params = validateMCPToolInput<typeof UpdateDNSRecordSchema._type>(tool, input)

    try {
      const updates: any = {}
      if (params.name) updates.name = params.name
      if (params.content) updates.data = params.content
      if (params.ttl) updates.ttl = params.ttl

      const result = await this.dnsService.updateRecord(
        params.domain,
        params.record_id,
        params.provider,
        params.jwt_token,
        updates
      )

      return createMCPResult(
        `✅ DNS Record Updated Successfully:\n` +
        `Record ID: ${result.id}\n` +
        `Domain: ${params.domain}\n` +
        `Type: ${result.type}\n` +
        `Name: ${result.name}\n` +
        `Content: ${result.data}\n` +
        `Provider: ${params.provider}\n` +
        `TTL: ${result.ttl} seconds\n` +
        `Status: Record updated and active\n` +
        `Note: Changes may take 1-5 minutes to propagate`
      )
    } catch (error) {
      return createMCPResult(`❌ DNS record update failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  /**
   * MCP Tool: Delete DNS Record
   */
  private async deleteDNSRecord(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_delete_dns_record')!
    const params = validateMCPToolInput<typeof DeleteDNSRecordSchema._type>(tool, input)

    try {
      await this.dnsService.deleteRecord(
        params.domain,
        params.record_id,
        params.provider,
        params.jwt_token
      )

      return createMCPResult(
        `✅ DNS Record Deleted Successfully:\n` +
        `Record ID: ${params.record_id}\n` +
        `Domain: ${params.domain}\n` +
        `Provider: ${params.provider}\n` +
        `Status: Record permanently removed\n` +
        `⚠️ Warning: This action cannot be undone\n` +
        `Note: DNS changes may take 1-5 minutes to propagate`
      )
    } catch (error) {
      return createMCPResult(`❌ DNS record deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  /**
   * MCP Tool: List DNS Records
   */
  private async listDNSRecords(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_list_dns_records')!
    const params = validateMCPToolInput<typeof ListDNSRecordsSchema._type>(tool, input)

    try {
      const records = await this.dnsService.listRecords(
        params.domain,
        params.provider,
        params.jwt_token,
        params.record_type
      )

      if (records.length === 0) {
        return createMCPResult(
          `📋 DNS Records for ${params.domain}:\n` +
          `Provider: ${params.provider}\n` +
          `Filter: ${params.record_type || 'ALL'}\n` +
          `\n⚠️ No records found matching criteria`
        )
      }

      return createMCPResult(
        `📋 DNS Records for ${params.domain}:\n` +
        `Provider: ${params.provider}\n` +
        `Filter: ${params.record_type || 'ALL'}\n` +
        `\n✅ Found ${records.length} records:\n\n` +
        records.map(r => 
          `🔹 ${r.type.padEnd(6)} | ${r.name.padEnd(15)} | ${r.data.padEnd(30)} | TTL: ${r.ttl}s | ID: ${r.id}`
        ).join('\n')
      )
    } catch (error) {
      return createMCPResult(`❌ DNS records listing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  /**
   * MCP Tool: Verify DNS Propagation
   */
  private async verifyDNSPropagation(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_verify_dns_propagation')!
    const params = validateMCPToolInput<typeof VerifyDNSPropagationSchema._type>(tool, input)

    try {
      const result = await this.dnsService.verifyPropagation(
        params.domain,
        params.record_type,
        params.expected_value,
        'cloudflare', // Default to Cloudflare for now
        params.jwt_token
      )

      const status = result.propagated ? '✅ Propagated' : '⏳ In Progress'
      const icon = result.propagated ? '🌍' : '⏱️'
      
      return createMCPResult(
        `${icon} DNS Propagation Verification:\n` +
        `Domain: ${params.domain}\n` +
        `Record Type: ${params.record_type}\n` +
        `Expected Value: ${params.expected_value}\n` +
        `Status: ${status}\n` +
        `Details: ${result.details}\n` +
        `\nGlobal DNS Servers: 8.8.8.8, 1.1.1.1, 208.67.222.222\n` +
        `${result.propagated ? 'DNS changes are live!' : 'Estimated completion: 5-10 minutes'}`
      )
    } catch (error) {
      return createMCPResult(`❌ DNS propagation verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  /**
   * MCP Tool: Configure Domain SSL
   */
  private async configureDomainSSL(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_configure_domain_ssl')!
    const params = validateMCPToolInput<typeof ConfigureDomainSSLSchema._type>(tool, input)

    try {
      const result = await this.dnsService.configureSSL(
        params.domain,
        params.provider,
        params.jwt_token,
        params.ssl_validation_method
      )

      if (!result.success) {
        throw new Error('SSL configuration failed')
      }

      const validationInfo = result.validationRecords?.map(record => 
        `  📝 ${record.type} record: ${record.name} -> ${record.data}`
      ).join('\n') || 'No validation records created'

      return createMCPResult(
        `🔒 SSL Configuration Initiated Successfully:\n` +
        `Domain: ${params.domain}\n` +
        `Validation Method: ${params.ssl_validation_method}\n` +
        `Provider: ${params.provider}\n` +
        `Status: ✅ Validation records created\n` +
        `\n📋 Validation Records Created:\n` +
        `${validationInfo}\n` +
        `\n🚀 Next Steps:\n` +
        `1. ✅ DNS validation records created\n` +
        `2. ⏳ SSL certificate request (automatic)\n` +
        `3. ⏳ HTTPS configuration\n` +
        `\n⏱️ Estimated completion: 5-15 minutes`
      )
    } catch (error) {
      return createMCPResult(`❌ SSL configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true)
    }
  }

  // EXECUTABLE DOMAIN SETUP TOOLS IMPLEMENTATION

  /**
   * EXECUTE: Complete Domain Setup
   */
  private async executeDomainSetup(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_execute_domain_setup')!
    const params = validateMCPToolInput<typeof ExecuteDomainSetupSchema._type>(tool, input)

    const executionId = this.generateExecutionId()
    
    console.log(`[Neptune] EXECUTE: Setting up domain ${params.domain} with target IP ${params.target_ip}`)

    try {
      const results = []
      const failures = []

      // Step 1: Create root A record
      try {
        const rootRecord = await this.dnsService.createRecord(
          params.domain,
          'A',
          '@',
          params.target_ip,
          params.provider,
          params.jwt_token,
          { ttl: 300 }
        )
        results.push(`✅ Root A record: ${params.domain} -> ${params.target_ip} (ID: ${rootRecord.id})`)
      } catch (error) {
        const message = `❌ Failed to create root A record: ${error instanceof Error ? error.message : 'Unknown error'}`
        failures.push(message)
        results.push(message)
      }

      // Step 2: Create subdomain records
      for (const subdomain of params.subdomains) {
        try {
          const subRecord = await this.dnsService.createRecord(
            params.domain,
            'A',
            subdomain,
            params.target_ip,
            params.provider,
            params.jwt_token,
            { ttl: 300 }
          )
          results.push(`✅ ${subdomain} A record: ${subdomain}.${params.domain} -> ${params.target_ip} (ID: ${subRecord.id})`)
        } catch (error) {
          const message = `❌ Failed to create ${subdomain} A record: ${error instanceof Error ? error.message : 'Unknown error'}`
          failures.push(message)
          results.push(message)
        }
      }

      // Step 3: Configure SSL if enabled
      if (params.ssl_enabled) {
        try {
          const sslResult = await this.dnsService.configureSSL(
            params.domain,
            params.provider,
            params.jwt_token,
            'dns'
          )
          
          if (sslResult.success) {
            results.push(`✅ SSL configuration initiated for ${params.domain}`)
            if (sslResult.validationRecords) {
              sslResult.validationRecords.forEach(record => {
                results.push(`  📝 SSL validation record: ${record.name} -> ${record.data}`)
              })
            }
          } else {
            const message = `⚠️ SSL configuration partially failed for ${params.domain}`
            failures.push(message)
            results.push(message)
          }
        } catch (error) {
          const message = `❌ SSL configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          failures.push(message)
          results.push(message)
        }
      }

      const successCount = results.filter(r => r.includes('✅')).length
      const failureCount = failures.length
      const status = failureCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'failed')

      console.log(`[Neptune] Domain setup ${status} for ${params.domain}: ${successCount} successes, ${failureCount} failures`)

      const statusIcon = status === 'completed' ? '🚀' : status === 'partial' ? '⚠️' : '❌'
      const statusText = status === 'completed' ? 'Completed Successfully' : 
                        status === 'partial' ? 'Partially Completed' : 'Failed'

      return createMCPResult(
        `${statusIcon} Domain Setup ${statusText}:\n` +
        `Execution ID: ${executionId}\n` +
        `Domain: ${params.domain}\n` +
        `Target IP: ${params.target_ip}\n` +
        `Provider: ${params.provider}\n` +
        `SSL Enabled: ${params.ssl_enabled ? 'Yes' : 'No'}\n` +
        `\n📋 Setup Results:\n${results.join('\n')}\n` +
        `\n📊 Summary: ${successCount} successful, ${failureCount} failed\n` +
        (failureCount === 0 ? 
          `\n🎉 Domain setup complete! DNS propagation may take 5-10 minutes.` :
          `\n⚠️ Some operations failed. Please review and retry failed operations.`)
      )

    } catch (error) {
      console.error(`[Neptune] Domain setup failed:`, error)
      return createMCPResult(
        `❌ Domain Setup Failed:\n` +
        `Execution ID: ${executionId}\n` +
        `Domain: ${params.domain}\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `\n🔧 Troubleshooting:\n` +
        `- Verify DNS provider credentials\n` +
        `- Check domain ownership\n` +
        `- Ensure target IP is valid`,
        true
      )
    }
  }

  /**
   * EXECUTE: SSL Setup
   */
  private async executeSSLSetup(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_execute_ssl_setup')!
    const params = validateMCPToolInput<typeof ExecuteSSLSetupSchema._type>(tool, input)

    const executionId = this.generateExecutionId()
    
    console.log(`[Neptune] EXECUTE: Setting up SSL for domain ${params.domain}`)

    try {
      // Configure SSL with DNS validation
      const sslResult = await this.dnsService.configureSSL(
        params.domain,
        params.provider,
        params.jwt_token,
        params.validation_method
      )

      if (!sslResult.success) {
        throw new Error('SSL setup failed - unable to create validation records')
      }

      // Verify SSL validation records were created
      const validationResults = []
      if (sslResult.validationRecords) {
        for (const record of sslResult.validationRecords) {
          try {
            // Verify the record exists
            const records = await this.dnsService.listRecords(
              params.domain,
              params.provider,
              params.jwt_token,
              record.type as any
            )
            
            const foundRecord = records.find(r => r.name === record.name && r.data === record.data)
            if (foundRecord) {
              validationResults.push(`✅ Validation record verified: ${record.name} -> ${record.data}`)
            } else {
              validationResults.push(`⚠️ Validation record pending: ${record.name} -> ${record.data}`)
            }
          } catch (error) {
            validationResults.push(`❌ Failed to verify record: ${record.name} (${error instanceof Error ? error.message : 'Unknown error'})`)
          }
        }
      }

      console.log(`[Neptune] SSL setup completed for ${params.domain}`)

      return createMCPResult(
        `🔒 SSL Setup Completed Successfully:\n` +
        `Execution ID: ${executionId}\n` +
        `Domain: ${params.domain}\n` +
        `Include WWW: ${params.include_www ? 'Yes' : 'No'}\n` +
        `Validation Method: ${params.validation_method}\n` +
        `Provider: ${params.provider}\n` +
        `\n📋 SSL Validation Records:\n${validationResults.join('\n')}\n` +
        `\n🚀 Next Steps:\n` +
        `1. ✅ DNS validation records created\n` +
        `2. ⏳ SSL certificate generation (5-15 minutes)\n` +
        `3. ⏳ HTTPS activation\n` +
        `\n⏱️ Certificate Status: Monitor your DNS provider dashboard\n` +
        `🌐 Test URL: https://${params.domain} (available after propagation)`
      )

    } catch (error) {
      console.error(`[Neptune] SSL setup failed:`, error)
      return createMCPResult(
        `❌ SSL Setup Failed:\n` +
        `Execution ID: ${executionId}\n` +
        `Domain: ${params.domain}\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `\n🔧 Common Issues:\n` +
        `- Domain not yet propagated\n` +
        `- Invalid DNS provider credentials\n` +
        `- Domain ownership verification needed\n` +
        `- DNS provider SSL features not enabled`,
        true
      )
    }
  }

  /**
   * EXECUTE: Domain Verification
   */
  private async executeDomainVerification(input: unknown): Promise<MCPToolResult> {
    const tool = NEPTUNE_MCP_TOOLS.find(t => t.name === 'neptune_execute_domain_verification')!
    const params = validateMCPToolInput<typeof ExecuteDomainVerificationSchema._type>(tool, input)

    const executionId = this.generateExecutionId()
    const startTime = Date.now()
    
    console.log(`[Neptune] EXECUTE: Verifying domain ${params.domain} with ${params.expected_records.length} expected records`)

    try {
      const verificationResults = []
      let allRecordsVerified = false
      let attempts = 0
      const maxAttempts = Math.floor(params.timeout_seconds / 30) // Check every 30 seconds

      while (!allRecordsVerified && attempts < maxAttempts) {
        attempts++
        const currentResults = []
        let verifiedCount = 0

        console.log(`[Neptune] Verification attempt ${attempts}/${maxAttempts} for ${params.domain}`)

        // Check each expected record
        for (const expectedRecord of params.expected_records) {
          try {
            const propagationResult = await this.dnsService.verifyPropagation(
              params.domain,
              expectedRecord.type,
              expectedRecord.content,
              params.provider,
              params.jwt_token
            )

            if (propagationResult.propagated) {
              currentResults.push(`✅ ${expectedRecord.type} ${expectedRecord.name}: ${expectedRecord.content} (VERIFIED)`)
              verifiedCount++
            } else {
              currentResults.push(`⏳ ${expectedRecord.type} ${expectedRecord.name}: ${expectedRecord.content} (PENDING)`)
            }
          } catch (error) {
            currentResults.push(`❌ ${expectedRecord.type} ${expectedRecord.name}: ${error instanceof Error ? error.message : 'Verification failed'}`)
          }
        }

        verificationResults.length = 0
        verificationResults.push(...currentResults)

        // Check if all records are verified
        allRecordsVerified = verifiedCount === params.expected_records.length

        if (!allRecordsVerified && attempts < maxAttempts) {
          // Wait 30 seconds before next check
          await new Promise(resolve => setTimeout(resolve, 30000))
        }
      }

      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
      const verifiedCount = verificationResults.filter(r => r.includes('VERIFIED')).length
      const totalCount = params.expected_records.length

      const status = allRecordsVerified ? 'completed' : 'timeout'
      const statusIcon = allRecordsVerified ? '✅' : '⏰'
      const statusText = allRecordsVerified ? 'All Records Verified' : 'Verification Timeout'

      console.log(`[Neptune] Domain verification ${status} for ${params.domain}: ${verifiedCount}/${totalCount} records verified in ${elapsedSeconds}s`)

      return createMCPResult(
        `${statusIcon} Domain Verification ${statusText}:\n` +
        `Execution ID: ${executionId}\n` +
        `Domain: ${params.domain}\n` +
        `Provider: ${params.provider}\n` +
        `Duration: ${elapsedSeconds}/${params.timeout_seconds} seconds\n` +
        `Attempts: ${attempts}\n` +
        `\n📋 Verification Results:\n${verificationResults.join('\n')}\n` +
        `\n📊 Summary: ${verifiedCount}/${totalCount} records verified\n` +
        (allRecordsVerified ? 
          `\n🎉 All DNS records are live and propagated globally!` :
          `\n⚠️ Verification incomplete. Some records may still be propagating.\n` +
          `💡 Try again in 5-10 minutes for remaining records.`)
      )

    } catch (error) {
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)
      console.error(`[Neptune] Domain verification failed:`, error)
      return createMCPResult(
        `❌ Domain Verification Failed:\n` +
        `Execution ID: ${executionId}\n` +
        `Domain: ${params.domain}\n` +
        `Duration: ${elapsedSeconds} seconds\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
        `\n🔧 Troubleshooting:\n` +
        `- Check DNS records exist in provider dashboard\n` +
        `- Verify domain nameservers are correct\n` +
        `- Allow more time for DNS propagation`,
        true
      )
    }
  }

  // HELPER METHODS

  private generateExecutionId(): string {
    return `neptune-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
  }
  // Updated with executable tools
}

// Export singleton instance
export const neptuneMCPServer = new NeptuneMCPServer()