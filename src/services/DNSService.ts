/**
 * DNS Service - Manages DNS operations with provider abstraction
 */

import axios from 'axios'
import { DNSProvider, DNSRecord, DNSRecordResult, DNSProviderError } from './DNSProvider'
import { CloudflareDNSProvider } from './CloudflareDNSProvider'
import { AdaptiveCloudflareProvider } from './AdaptiveCloudflareProvider'
import { AIAssistedDNSProvider } from './AIAssistedDNSProvider'
import { DigitalOceanDNSProvider } from './DigitalOceanDNSProvider'

export class DNSService {
  private providers: Map<string, DNSProvider> = new Map()
  private contextManagerUrl: string
  private useAdaptiveMode: boolean = true

  constructor(contextManagerUrl = 'http://localhost:3002') {
    this.contextManagerUrl = contextManagerUrl
  }

  /**
   * Get DNS provider credentials from Context Manager
   */
  private async getProviderCredentials(provider: string, jwtToken: string): Promise<string> {
    // Development mode: use environment variables when JWT token is 'dev-mode'
    if (process.env.NODE_ENV === 'development' && jwtToken === 'dev-mode') {
      console.log(`[DNS Service] Development mode - using environment variables for ${provider}`)
      const envVarName = `${provider.toUpperCase()}_API_TOKEN`
      const envToken = process.env[envVarName]
      
      if (envToken) {
        console.log(`[DNS Service] Found ${provider} token in environment variables`)
        return envToken
      } else {
        throw new DNSProviderError(
          `No ${provider} API token found in environment variables (${envVarName})`,
          400,
          provider
        )
      }
    }

    try {
      console.log(`[DNS Service] Retrieving ${provider} credentials from Context Manager`)
      console.log(`[DNS Service] Context Manager URL: ${this.contextManagerUrl}`)
      console.log(`[DNS Service] JWT Token present: ${!!jwtToken}`)
      
      const response = await axios.get(`${this.contextManagerUrl}/api/v1/context/secret/credential/${provider}_api_token`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      })

      console.log(`[DNS Service] Context Manager response status: ${response.status}`)
      console.log(`[DNS Service] Context Manager response success: ${response.data?.success}`)

      if (!response.data.success || !response.data.data?.value) {
        console.error(`[DNS Service] Context Manager response data:`, response.data)
        throw new Error(`No ${provider} API token found in Context Manager`)
      }

      console.log(`[DNS Service] Successfully retrieved ${provider} credentials (length: ${response.data.data.value.length})`)
      return response.data.data.value
    } catch (error: any) {
      console.error(`[DNS Service] Failed to get ${provider} credentials:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: `${this.contextManagerUrl}/api/v1/context/secret/credential/${provider}_api_token`
      })

      // Fallback to environment variables if Context Manager fails
      if (process.env.NODE_ENV === 'development') {
        const envVarName = `${provider.toUpperCase()}_API_TOKEN`
        const envToken = process.env[envVarName]
        
        if (envToken) {
          console.log(`[DNS Service] Falling back to environment variable ${envVarName}`)
          return envToken
        }
      }
      
      throw new DNSProviderError(
        `Failed to retrieve ${provider} credentials: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        provider
      )
    }
  }

  /**
   * Get or create DNS provider instance
   */
  private async getDNSProvider(provider: string, jwtToken: string): Promise<DNSProvider> {
    const cacheKey = `${provider}_${jwtToken.slice(-10)}` // Use last 10 chars as cache key
    
    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!
    }

    let dnsProvider: DNSProvider

    switch (provider.toLowerCase()) {
      case 'cloudflare':
        const cfToken = await this.getProviderCredentials('cloudflare', jwtToken)
        
        // Prioritize AI-assisted provider for maximum intelligence
        if (process.env.USE_AI_DNS === 'true' || process.env.NODE_ENV === 'development') {
          console.log('[DNS Service] Using AI-Assisted Cloudflare Provider for intelligent problem solving')
          dnsProvider = new AIAssistedDNSProvider(cfToken, {
            accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
            zoneId: process.env.CLOUDFLARE_ZONE_ID
          })
        } else if (this.useAdaptiveMode) {
          console.log('[DNS Service] Using Adaptive Cloudflare Provider for intelligent DNS management')
          dnsProvider = new AdaptiveCloudflareProvider(cfToken, {
            accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
            zoneId: process.env.CLOUDFLARE_ZONE_ID,
            debug: process.env.NODE_ENV === 'development'
          })
        } else {
          dnsProvider = new CloudflareDNSProvider(cfToken)
        }
        break
      
      case 'digitalocean':
        const doToken = await this.getProviderCredentials('digitalocean', jwtToken)
        dnsProvider = new DigitalOceanDNSProvider(doToken)
        break
      
      default:
        throw new DNSProviderError(`Unsupported DNS provider: ${provider}. Supported providers: cloudflare, digitalocean`, 400)
    }

    this.providers.set(cacheKey, dnsProvider)
    return dnsProvider
  }

  /**
   * Validate domain exists with the provider
   */
  async validateDomain(
    domain: string,
    provider: string,
    jwtToken: string
  ): Promise<boolean> {
    try {
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      console.log(`[DNS Service] Validating domain: ${domain} with ${provider}`)
      
      // Try to list records for the domain to verify it exists
      try {
        const records = await dnsProvider.listRecords(domain)
        console.log(`[DNS Service] Domain ${domain} exists with ${records.length} records`)
        return true
      } catch (error: any) {
        // Check if it's a 404 or domain not found error
        if (error.statusCode === 404 || 
            error.message?.includes('not found') || 
            error.message?.includes('does not exist')) {
          console.log(`[DNS Service] Domain ${domain} does not exist with ${provider}`)
          return false
        }
        // For other errors, rethrow
        throw error
      }
    } catch (error) {
      console.error(`[DNS Service] Domain validation failed:`, error)
      throw error
    }
  }

  /**
   * Create DNS record
   */
  async createRecord(
    domain: string, 
    recordType: string, 
    name: string, 
    content: string, 
    provider: string,
    jwtToken: string,
    options: { ttl?: number; priority?: number } = {}
  ): Promise<DNSRecordResult> {
    try {
      // Validate domain exists first
      const domainExists = await this.validateDomain(domain, provider, jwtToken)
      if (!domainExists) {
        throw new DNSProviderError(
          `Domain ${domain} does not exist with ${provider}. Please create the domain first.`,
          404,
          provider
        )
      }
      
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      const record: Omit<DNSRecord, 'id'> = {
        type: recordType as any,
        name: name,
        data: content,
        ttl: options.ttl || 300,
        priority: options.priority
      }

      console.log(`[DNS Service] Creating ${recordType} record: ${name}.${domain} -> ${content}`)
      const result = await dnsProvider.createRecord(domain, record)
      
      console.log(`[DNS Service] Successfully created record with ID: ${result.id}`)
      return result
    } catch (error) {
      console.error('[DNS Service] Create record failed:', error)
      throw error
    }
  }

  /**
   * Update DNS record
   */
  async updateRecord(
    domain: string,
    recordId: string,
    provider: string,
    jwtToken: string,
    updates: Partial<DNSRecord>
  ): Promise<DNSRecordResult> {
    try {
      // Validate domain exists first
      const domainExists = await this.validateDomain(domain, provider, jwtToken)
      if (!domainExists) {
        throw new DNSProviderError(
          `Domain ${domain} does not exist with ${provider}. Cannot update records for non-existent domain.`,
          404,
          provider
        )
      }
      
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      console.log(`[DNS Service] Updating record ${recordId} for ${domain}`)
      const result = await dnsProvider.updateRecord(domain, recordId, updates)
      
      console.log(`[DNS Service] Successfully updated record ${recordId}`)
      return result
    } catch (error) {
      console.error('[DNS Service] Update record failed:', error)
      throw error
    }
  }

  /**
   * Delete DNS record
   */
  async deleteRecord(
    domain: string,
    recordId: string,
    provider: string,
    jwtToken: string
  ): Promise<void> {
    try {
      // Validate domain exists first
      const domainExists = await this.validateDomain(domain, provider, jwtToken)
      if (!domainExists) {
        throw new DNSProviderError(
          `Domain ${domain} does not exist with ${provider}. Cannot delete records for non-existent domain.`,
          404,
          provider
        )
      }
      
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      console.log(`[DNS Service] Deleting record ${recordId} for ${domain}`)
      await dnsProvider.deleteRecord(domain, recordId)
      
      console.log(`[DNS Service] Successfully deleted record ${recordId}`)
    } catch (error) {
      console.error('[DNS Service] Delete record failed:', error)
      throw error
    }
  }

  /**
   * List DNS records
   */
  async listRecords(
    domain: string,
    provider: string,
    jwtToken: string,
    recordType?: string
  ): Promise<DNSRecordResult[]> {
    try {
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      console.log(`[DNS Service] Listing records for ${domain}`)
      
      // List records will naturally return empty array or error if domain doesn't exist
      // We handle it gracefully here
      const records = await dnsProvider.listRecords(domain, recordType).catch(error => {
        if (error.statusCode === 404 || 
            error.message?.includes('not found') || 
            error.message?.includes('does not exist')) {
          console.warn(`[DNS Service] Domain ${domain} does not exist, returning empty records`)
          return []
        }
        throw error
      })
      
      console.log(`[DNS Service] Found ${records.length} records`)
      return records
    } catch (error) {
      console.error('[DNS Service] List records failed:', error)
      throw error
    }
  }

  /**
   * Verify domain ownership
   */
  async verifyDomainOwnership(
    domain: string,
    provider: string,
    jwtToken: string
  ): Promise<boolean> {
    try {
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      console.log(`[DNS Service] Verifying ownership of ${domain}`)
      const isOwned = await dnsProvider.verifyDomainOwnership(domain)
      
      console.log(`[DNS Service] Domain ${domain} ownership: ${isOwned}`)
      return isOwned
    } catch (error) {
      console.error('[DNS Service] Domain verification failed:', error)
      throw error
    }
  }

  /**
   * Configure SSL for domain (creates DNS validation records)
   */
  async configureSSL(
    domain: string,
    provider: string,
    jwtToken: string,
    method: 'dns' | 'http' = 'dns'
  ): Promise<{ success: boolean; validationRecords?: DNSRecordResult[] }> {
    try {
      // Validate domain exists first for DNS-based SSL
      if (method === 'dns') {
        const domainExists = await this.validateDomain(domain, provider, jwtToken)
        if (!domainExists) {
          throw new DNSProviderError(
            `Domain ${domain} does not exist with ${provider}. Please create the domain before configuring SSL.`,
            404,
            provider
          )
        }
      }
      console.log(`[DNS Service] Configuring SSL for ${domain} using ${method} validation`)
      
      if (method !== 'dns') {
        throw new DNSProviderError('Only DNS validation is currently supported', 400)
      }

      // This is a simplified SSL setup - in production you'd integrate with Let's Encrypt or CF SSL
      // For now, we'll create a TXT record that simulates SSL validation
      const validationToken = `controlvector-ssl-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
      
      const txtRecord = await this.createRecord(
        domain,
        'TXT',
        '_acme-challenge',
        validationToken,
        provider,
        jwtToken,
        { ttl: 60 }
      )

      console.log(`[DNS Service] Created SSL validation record for ${domain}`)
      
      return {
        success: true,
        validationRecords: [txtRecord]
      }
    } catch (error) {
      console.error('[DNS Service] SSL configuration failed:', error)
      throw error
    }
  }

  /**
   * Verify DNS propagation
   */
  async verifyPropagation(
    domain: string,
    recordType: string,
    expectedValue: string,
    provider: string,
    jwtToken: string
  ): Promise<{ propagated: boolean; details: string }> {
    try {
      console.log(`[DNS Service] Checking DNS propagation for ${recordType} ${domain}`)
      
      const dnsProvider = await this.getDNSProvider(provider, jwtToken)
      
      // Check if provider supports propagation checking
      if ('checkPropagation' in dnsProvider) {
        const propagated = await (dnsProvider as any).checkPropagation(domain, recordType, expectedValue)
        return {
          propagated,
          details: propagated 
            ? 'DNS record has propagated globally'
            : 'DNS record is still propagating - may take 5-10 minutes'
        }
      } else {
        // Fallback: just check if record exists
        const records = await dnsProvider.listRecords(domain, recordType)
        const matchingRecord = records.find(r => r.data === expectedValue)
        
        return {
          propagated: !!matchingRecord,
          details: matchingRecord 
            ? 'DNS record found in provider - propagation in progress'
            : 'DNS record not found or value mismatch'
        }
      }
    } catch (error) {
      console.error('[DNS Service] Propagation check failed:', error)
      return {
        propagated: false,
        details: `Propagation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }
}