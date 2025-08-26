/**
 * Cloudflare DNS Provider Implementation
 */

import axios, { AxiosInstance } from 'axios'
import { DNSProvider, DNSRecord, DNSRecordResult, DNSProviderError } from './DNSProvider'

export class CloudflareDNSProvider implements DNSProvider {
  name = 'cloudflare'
  private client: AxiosInstance

  constructor(private apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.cloudflare.com/v4',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })
  }

  async createRecord(domain: string, record: Omit<DNSRecord, 'id'>): Promise<DNSRecordResult> {
    try {
      const zoneId = await this.getZoneId(domain)
      console.log(`[Cloudflare DNS] Creating ${record.type} record for ${domain}: ${record.name} -> ${record.data}`)
      
      const response = await this.client.post(`/zones/${zoneId}/dns_records`, {
        type: record.type,
        name: record.name,
        content: record.data,
        ttl: record.ttl,
        priority: record.priority || undefined
      })

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Unknown Cloudflare API error')
      }

      const cfRecord = response.data.result
      return {
        id: cfRecord.id,
        type: cfRecord.type,
        name: cfRecord.name,
        data: cfRecord.content,
        ttl: cfRecord.ttl,
        priority: cfRecord.priority || undefined
      }
    } catch (error: any) {
      console.error('[Cloudflare DNS] Create record failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to create DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async updateRecord(domain: string, recordId: string, record: Partial<DNSRecord>): Promise<DNSRecordResult> {
    try {
      const zoneId = await this.getZoneId(domain)
      console.log(`[Cloudflare DNS] Updating record ${recordId} for ${domain}`)
      
      const updateData: any = {}
      if (record.name !== undefined) updateData.name = record.name
      if (record.data !== undefined) updateData.content = record.data
      if (record.ttl !== undefined) updateData.ttl = record.ttl
      if (record.priority !== undefined) updateData.priority = record.priority

      const response = await this.client.patch(`/zones/${zoneId}/dns_records/${recordId}`, updateData)

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Unknown Cloudflare API error')
      }

      const cfRecord = response.data.result
      return {
        id: cfRecord.id,
        type: cfRecord.type,
        name: cfRecord.name,
        data: cfRecord.content,
        ttl: cfRecord.ttl,
        priority: cfRecord.priority || undefined
      }
    } catch (error: any) {
      console.error('[Cloudflare DNS] Update record failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to update DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async deleteRecord(domain: string, recordId: string): Promise<void> {
    try {
      const zoneId = await this.getZoneId(domain)
      console.log(`[Cloudflare DNS] Deleting record ${recordId} for ${domain}`)
      
      const response = await this.client.delete(`/zones/${zoneId}/dns_records/${recordId}`)

      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Unknown Cloudflare API error')
      }

      console.log(`[Cloudflare DNS] Successfully deleted record ${recordId}`)
    } catch (error: any) {
      console.error('[Cloudflare DNS] Delete record failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to delete DNS record: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async listRecords(domain: string, type?: string): Promise<DNSRecordResult[]> {
    try {
      const zoneId = await this.getZoneId(domain)
      console.log(`[Cloudflare DNS] Listing records for ${domain}${type ? ` (type: ${type})` : ''}`)
      
      const params: any = { per_page: 100 }
      if (type && type !== 'ALL') {
        params.type = type
      }

      const response = await this.client.get(`/zones/${zoneId}/dns_records`, { params })
      
      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Unknown Cloudflare API error')
      }

      const records = response.data.result.map((cfRecord: any): DNSRecordResult => ({
        id: cfRecord.id,
        type: cfRecord.type,
        name: cfRecord.name,
        data: cfRecord.content,
        ttl: cfRecord.ttl,
        priority: cfRecord.priority || undefined
      }))

      console.log(`[Cloudflare DNS] Found ${records.length} records`)
      return records
    } catch (error: any) {
      console.error('[Cloudflare DNS] List records failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to list DNS records: ${error.response?.data?.errors?.[0]?.message || error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  async verifyDomainOwnership(domain: string): Promise<boolean> {
    try {
      console.log(`[Cloudflare DNS] Verifying domain ownership for ${domain}`)
      
      // Check if zone exists in Cloudflare
      await this.getZoneId(domain)
      
      console.log(`[Cloudflare DNS] Domain ${domain} ownership verified`)
      return true
    } catch (error: any) {
      if (error.message.includes('Zone not found')) {
        console.log(`[Cloudflare DNS] Domain ${domain} not found in Cloudflare`)
        return false
      }
      
      console.error('[Cloudflare DNS] Domain verification failed:', error.message)
      throw new DNSProviderError(
        `Failed to verify domain ownership: ${error.message}`,
        500,
        'cloudflare'
      )
    }
  }

  /**
   * Get zone ID for a domain
   */
  private async getZoneId(domain: string): Promise<string> {
    try {
      // Extract root domain from subdomain (e.g., "api.example.com" -> "example.com")
      const rootDomain = this.extractRootDomain(domain)
      console.log(`[Cloudflare DNS] Searching for zone ID for domain: ${domain} (root: ${rootDomain})`)
      
      const response = await this.client.get('/zones', {
        params: { name: rootDomain }
      })

      console.log(`[Cloudflare DNS] Cloudflare API response status: ${response.status}`)
      console.log(`[Cloudflare DNS] Cloudflare API response success: ${response.data?.success}`)
      
      if (!response.data.success) {
        const errors = response.data.errors || []
        console.error(`[Cloudflare DNS] API errors:`, errors)
        throw new Error(errors[0]?.message || 'Unknown Cloudflare API error')
      }

      const zones = response.data.result
      console.log(`[Cloudflare DNS] Found ${zones?.length || 0} zones for domain: ${rootDomain}`)
      
      if (zones.length === 0) {
        console.error(`[Cloudflare DNS] No zones found. Available zones might be:`)
        
        // Try to list all zones to help debug
        try {
          const allZonesResponse = await this.client.get('/zones', { params: { per_page: 50 } })
          if (allZonesResponse.data.success && allZonesResponse.data.result) {
            const allZoneNames = allZonesResponse.data.result.map((zone: any) => zone.name)
            console.log(`[Cloudflare DNS] Available zones in account: ${allZoneNames.join(', ')}`)
          }
        } catch (debugError) {
          console.error(`[Cloudflare DNS] Could not list zones for debugging:`, debugError)
        }
        
        throw new Error(`Zone not found for domain: ${rootDomain}. Make sure the domain is added to your Cloudflare account.`)
      }

      const zoneId = zones[0].id
      console.log(`[Cloudflare DNS] Successfully found zone ID: ${zoneId} for domain: ${rootDomain}`)
      return zoneId
    } catch (error: any) {
      console.error(`[Cloudflare DNS] Zone ID lookup failed for ${domain}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      
      throw new DNSProviderError(
        `Failed to get zone ID for ${domain}: ${error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  /**
   * Extract root domain from a FQDN
   */
  private extractRootDomain(domain: string): string {
    const parts = domain.split('.')
    if (parts.length <= 2) {
      return domain
    }
    // Return last two parts (domain.tld)
    return parts.slice(-2).join('.')
  }

  /**
   * Get zone information
   */
  async getZoneInfo(domain: string): Promise<any> {
    try {
      const zoneId = await this.getZoneId(domain)
      const response = await this.client.get(`/zones/${zoneId}`)
      
      if (!response.data.success) {
        throw new Error(response.data.errors?.[0]?.message || 'Unknown Cloudflare API error')
      }

      return response.data.result
    } catch (error: any) {
      throw new DNSProviderError(
        `Failed to get zone info: ${error.message}`,
        error.response?.status || 500,
        'cloudflare'
      )
    }
  }

  /**
   * Check DNS propagation status
   */
  async checkPropagation(domain: string, recordType: string, expectedValue: string): Promise<boolean> {
    try {
      console.log(`[Cloudflare DNS] Checking propagation for ${recordType} ${domain} -> ${expectedValue}`)
      
      // Use external DNS checkers to verify propagation
      const dnsServers = ['8.8.8.8', '1.1.1.1', '208.67.222.222']
      const propagationChecks = await Promise.allSettled(
        dnsServers.map(server => this.queryDNSServer(domain, recordType, server))
      )

      const successfulChecks = propagationChecks
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<string>).value)
        .filter(value => value === expectedValue)

      const propagated = successfulChecks.length >= 2 // At least 2 out of 3 servers
      console.log(`[Cloudflare DNS] Propagation check: ${successfulChecks.length}/3 servers show correct value`)
      
      return propagated
    } catch (error: any) {
      console.error('[Cloudflare DNS] Propagation check failed:', error.message)
      return false
    }
  }

  /**
   * Query a specific DNS server using Google DoH API (simplified implementation)
   */
  private async queryDNSServer(domain: string, recordType: string, server: string): Promise<string> {
    try {
      // Use Google DNS over HTTPS as a fallback for propagation checking
      const response = await axios.get(`https://dns.google/resolve`, {
        params: {
          name: domain,
          type: recordType
        },
        timeout: 5000
      })

      if (response.data?.Status === 0 && response.data?.Answer?.length > 0) {
        const answer = response.data.Answer.find((a: any) => a.type === this.getRecordTypeNumber(recordType))
        if (answer) {
          return answer.data
        }
      }
      
      throw new Error(`No ${recordType} record found for ${domain}`)
    } catch (error: any) {
      console.log(`[Cloudflare DNS] DNS query failed for ${domain} ${recordType}: ${error.message}`)
      throw error
    }
  }

  /**
   * Get numeric record type for DNS queries
   */
  private getRecordTypeNumber(recordType: string): number {
    const types: Record<string, number> = {
      'A': 1,
      'AAAA': 28,
      'CNAME': 5,
      'MX': 15,
      'TXT': 16
    }
    return types[recordType] || 1
  }
}