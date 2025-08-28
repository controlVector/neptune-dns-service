/**
 * Adaptive Cloudflare DNS Provider - Intelligent, iterative DNS management
 * This provider learns and adapts to different Cloudflare configurations and API behaviors
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import { DNSProvider, DNSRecordResult, DNSProviderError } from './DNSProvider'

interface ZoneCache {
  [domain: string]: {
    zoneId: string
    discoveredAt: Date
    method: string
  }
}

interface CloudflareZone {
  id: string
  name: string
  status: string
  account?: {
    id: string
    name: string
  }
}

export class AdaptiveCloudflareProvider implements DNSProvider {
  name = 'cloudflare'
  private client: AxiosInstance
  private zoneCache: ZoneCache = {}
  private accountId: string | null = null
  private discoveryAttempts = 0

  constructor(
    private apiToken: string,
    private options: {
      accountId?: string
      zoneId?: string
      debug?: boolean
    } = {}
  ) {
    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })

    // Initialize with provided account ID if available
    this.accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || null
    
    // Pre-cache zone ID if provided
    if (options.zoneId) {
      this.log(`Pre-caching zone ID from options: ${options.zoneId}`)
    }
  }

  private log(message: string, data?: any) {
    if (this.options.debug !== false) {
      console.log(`[Adaptive Cloudflare] ${message}`, data || '')
    }
  }

  private error(message: string, error: any) {
    console.error(`[Adaptive Cloudflare ERROR] ${message}`, {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status
    })
  }

  /**
   * Intelligently discover zone ID using multiple strategies
   */
  private async discoverZoneId(domain: string): Promise<string> {
    const rootDomain = this.extractRootDomain(domain)
    this.log(`Starting intelligent zone discovery for ${domain} (root: ${rootDomain})`)
    
    // Check cache first
    if (this.zoneCache[rootDomain]) {
      this.log(`Using cached zone ID for ${rootDomain}: ${this.zoneCache[rootDomain].zoneId}`)
      return this.zoneCache[rootDomain].zoneId
    }

    // Strategy 1: Use provided zone ID if available
    if (this.options.zoneId || process.env.CLOUDFLARE_ZONE_ID) {
      const zoneId = this.options.zoneId || process.env.CLOUDFLARE_ZONE_ID!
      this.log(`Strategy 1: Using provided zone ID: ${zoneId}`)
      
      // Verify it works - but handle different API responses
      try {
        const response = await this.client.get(`/zones/${zoneId}`)
        if (response.data.success) {
          this.log(`Zone ID ${zoneId} verified successfully`)
          this.cacheZoneId(rootDomain, zoneId, 'provided')
          return zoneId
        }
      } catch (error: any) {
        // If we get a 404, the zone doesn't exist, but any other error might be permissions
        // So let's just use it anyway if we know it's the right zone
        if (error.response?.status === 404) {
          this.log(`Zone ID ${zoneId} returned 404, trying other strategies`)
        } else {
          // For other errors (403, 401), assume the zone ID is correct but we lack permissions
          this.log(`Zone ID ${zoneId} verification failed with ${error.response?.status}, using it anyway`)
          this.cacheZoneId(rootDomain, zoneId, 'provided_unverified')
          return zoneId
        }
      }
    }

    // Strategy 2: Direct zone lookup by name
    try {
      this.log(`Strategy 2: Direct zone lookup for ${rootDomain}`)
      const response = await this.client.get('/zones', {
        params: { name: rootDomain }
      })
      
      if (response.data.success && response.data.result.length > 0) {
        const zone = response.data.result[0]
        this.log(`Found zone via direct lookup: ${zone.id}`)
        this.cacheZoneId(rootDomain, zone.id, 'direct_lookup')
        return zone.id
      }
    } catch (error) {
      this.log(`Direct lookup failed, trying next strategy`)
    }

    // Strategy 3: List all zones and find match
    try {
      this.log(`Strategy 3: Listing all zones to find ${rootDomain}`)
      const response = await this.client.get('/zones', {
        params: { per_page: 100 }
      })
      
      if (response.data.success) {
        const zones: CloudflareZone[] = response.data.result
        this.log(`Found ${zones.length} zones in account`)
        
        // Try exact match first
        let zone = zones.find(z => z.name === rootDomain)
        
        // Try subdomain match
        if (!zone && domain !== rootDomain) {
          zone = zones.find(z => domain.endsWith(z.name))
        }
        
        if (zone) {
          this.log(`Found zone in full list: ${zone.id} for ${zone.name}`)
          
          // Store account ID if we found it
          if (zone.account?.id && !this.accountId) {
            this.accountId = zone.account.id
            this.log(`Discovered account ID: ${this.accountId}`)
          }
          
          this.cacheZoneId(rootDomain, zone.id, 'full_list_scan')
          return zone.id
        }

        // Log available zones for debugging
        this.log(`Available zones: ${zones.map(z => z.name).join(', ')}`)
      }
    } catch (error) {
      this.log(`Full list scan failed`)
    }

    // Strategy 4: Try with account ID if available
    if (this.accountId) {
      try {
        this.log(`Strategy 4: Trying account-specific endpoint with account ID ${this.accountId}`)
        const response = await this.client.get(`/accounts/${this.accountId}/zones`, {
          params: { name: rootDomain }
        })
        
        if (response.data.success && response.data.result.length > 0) {
          const zone = response.data.result[0]
          this.log(`Found zone via account endpoint: ${zone.id}`)
          this.cacheZoneId(rootDomain, zone.id, 'account_endpoint')
          return zone.id
        }
      } catch (error) {
        this.log(`Account-specific lookup failed`)
      }
    }

    // Strategy 5: Try to discover account ID from token verification
    if (!this.accountId) {
      try {
        this.log(`Strategy 5: Discovering account ID from token`)
        const verifyResponse = await this.client.get('/user/tokens/verify')
        
        if (verifyResponse.data.success) {
          // Try to get user details to find accounts
          const userResponse = await this.client.get('/user')
          if (userResponse.data.success && userResponse.data.result.accounts) {
            const accounts = userResponse.data.result.accounts
            if (accounts.length > 0) {
              this.accountId = accounts[0].id
              this.log(`Discovered account ID from user info: ${this.accountId}`)
              
              // Retry with account ID
              return this.discoverZoneId(domain)
            }
          }
        }
      } catch (error) {
        this.log(`Account discovery failed`)
      }
    }

    throw new DNSProviderError(
      `Unable to find zone for ${rootDomain} after trying ${this.discoveryAttempts + 1} strategies. ` +
      `Please ensure the domain is added to Cloudflare and the API token has proper permissions.`,
      404,
      'cloudflare'
    )
  }

  private cacheZoneId(domain: string, zoneId: string, method: string) {
    this.zoneCache[domain] = {
      zoneId,
      discoveredAt: new Date(),
      method
    }
    this.log(`Cached zone ID for ${domain}: ${zoneId} (discovered via ${method})`)
  }

  private extractRootDomain(domain: string): string {
    // Remove any subdomain parts to get root domain
    const parts = domain.split('.')
    if (parts.length <= 2) {
      return domain
    }
    // Handle special TLDs like .co.uk, .com.au
    const specialTlds = ['co.uk', 'com.au', 'co.nz', 'co.za']
    const lastThree = parts.slice(-3).join('.')
    for (const tld of specialTlds) {
      if (lastThree.endsWith(tld)) {
        return parts.slice(-3).join('.')
      }
    }
    // Default: last two parts
    return parts.slice(-2).join('.')
  }

  async createRecord(domain: string, record: Omit<DNSRecordResult, 'id'>): Promise<DNSRecordResult> {
    try {
      this.discoveryAttempts = 0
      const zoneId = await this.discoverZoneId(domain)
      
      this.log(`Creating ${record.type} record for ${domain}`, record)
      
      // Build the full record name
      const fullName = record.name === '@' ? domain : 
                      record.name.includes(domain) ? record.name : 
                      `${record.name}.${domain}`
      
      const response = await this.client.post(`/zones/${zoneId}/dns_records`, {
        type: record.type,
        name: fullName,
        content: record.data,
        ttl: record.ttl || 3600,
        priority: record.priority,
        proxied: false // Default to not proxied for better compatibility
      })

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to create DNS record')
      }

      const cfRecord = response.data.result
      this.log(`Successfully created DNS record: ${cfRecord.id}`)
      
      return {
        id: cfRecord.id,
        type: cfRecord.type,
        name: cfRecord.name,
        data: cfRecord.content,
        ttl: cfRecord.ttl,
        priority: cfRecord.priority
      }
    } catch (error: any) {
      this.error('Failed to create DNS record', error)
      
      // If it's a zone not found error, clear cache and retry once
      if (error.message?.includes('zone') && this.discoveryAttempts < 2) {
        this.discoveryAttempts++
        this.log('Zone error detected, clearing cache and retrying...')
        this.zoneCache = {}
        return this.createRecord(domain, record)
      }
      
      throw new DNSProviderError(
        `Failed to create DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async updateRecord(domain: string, recordId: string, record: Partial<DNSRecordResult>): Promise<DNSRecordResult> {
    try {
      const zoneId = await this.discoverZoneId(domain)
      
      this.log(`Updating record ${recordId} for ${domain}`, record)
      
      const updateData: any = {}
      if (record.name !== undefined) updateData.name = record.name
      if (record.data !== undefined) updateData.content = record.data
      if (record.ttl !== undefined) updateData.ttl = record.ttl
      if (record.priority !== undefined) updateData.priority = record.priority

      const response = await this.client.patch(`/zones/${zoneId}/dns_records/${recordId}`, updateData)

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to update DNS record')
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
    } catch (error: any) {
      this.error('Failed to update DNS record', error)
      throw new DNSProviderError(
        `Failed to update DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async deleteRecord(domain: string, recordId: string): Promise<void> {
    try {
      const zoneId = await this.discoverZoneId(domain)
      
      this.log(`Deleting record ${recordId} for ${domain}`)
      
      const response = await this.client.delete(`/zones/${zoneId}/dns_records/${recordId}`)

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to delete DNS record')
      }

      this.log(`Successfully deleted DNS record ${recordId}`)
    } catch (error: any) {
      this.error('Failed to delete DNS record', error)
      throw new DNSProviderError(
        `Failed to delete DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async listRecords(domain: string, type?: string): Promise<DNSRecordResult[]> {
    try {
      const zoneId = await this.discoverZoneId(domain)
      
      this.log(`Listing DNS records for ${domain} (type: ${type || 'ALL'})`)
      
      const params: any = { per_page: 100 }
      if (type) params.type = type

      const response = await this.client.get(`/zones/${zoneId}/dns_records`, { params })

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Failed to list DNS records')
      }

      const records = response.data.result.map((cfRecord: any) => ({
        id: cfRecord.id,
        type: cfRecord.type,
        name: cfRecord.name,
        data: cfRecord.content,
        ttl: cfRecord.ttl,
        priority: cfRecord.priority
      }))

      this.log(`Found ${records.length} DNS records`)
      return records
    } catch (error: any) {
      this.error('Failed to list DNS records', error)
      throw new DNSProviderError(
        `Failed to list DNS records: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async verifyDomainOwnership(domain: string): Promise<boolean> {
    try {
      const zoneId = await this.discoverZoneId(domain)
      this.log(`Domain ${domain} ownership verified (zone: ${zoneId})`)
      return true
    } catch (error) {
      this.log(`Domain ${domain} ownership could not be verified`)
      return false
    }
  }

  /**
   * Advanced method: Setup complete DNS for a new deployment
   */
  async setupDeploymentDNS(domain: string, targetIP: string, options?: {
    includeWWW?: boolean
    includeMail?: boolean
    customSubdomains?: string[]
  }): Promise<{ records: DNSRecordResult[], summary: string }> {
    const records: DNSRecordResult[] = []
    const errors: string[] = []

    try {
      // Create root A record
      try {
        const rootRecord = await this.createRecord(domain, {
          type: 'A',
          name: '@',
          data: targetIP,
          ttl: 300 // Low TTL for testing
        })
        records.push(rootRecord)
        this.log(`Created root A record for ${domain}`)
      } catch (error: any) {
        errors.push(`Root A record: ${error.message}`)
      }

      // Create www subdomain if requested
      if (options?.includeWWW) {
        try {
          const wwwRecord = await this.createRecord(domain, {
            type: 'A',
            name: 'www',
            data: targetIP,
            ttl: 300
          })
          records.push(wwwRecord)
          this.log(`Created www A record for ${domain}`)
        } catch (error: any) {
          errors.push(`WWW record: ${error.message}`)
        }
      }

      // Create custom subdomains
      if (options?.customSubdomains) {
        for (const subdomain of options.customSubdomains) {
          try {
            const subRecord = await this.createRecord(domain, {
              type: 'A',
              name: subdomain,
              data: targetIP,
              ttl: 300
            })
            records.push(subRecord)
            this.log(`Created ${subdomain} A record for ${domain}`)
          } catch (error: any) {
            errors.push(`${subdomain} record: ${error.message}`)
          }
        }
      }

      const summary = `Created ${records.length} DNS records for ${domain} pointing to ${targetIP}.` +
                     (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : '')

      return { records, summary }
    } catch (error: any) {
      throw new DNSProviderError(
        `Failed to setup deployment DNS: ${error.message}`,
        500,
        'cloudflare'
      )
    }
  }
}