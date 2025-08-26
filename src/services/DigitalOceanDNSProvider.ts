/**
 * DigitalOcean DNS Provider Implementation
 */

import axios, { AxiosInstance } from 'axios'
import { DNSProvider, DNSRecord, DNSRecordResult, DNSProviderError } from './DNSProvider'

export class DigitalOceanDNSProvider implements DNSProvider {
  name = 'digitalocean'
  private client: AxiosInstance

  constructor(private apiToken: string) {
    this.client = axios.create({
      baseURL: 'https://api.digitalocean.com/v2',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    })
  }

  async createRecord(domain: string, record: Omit<DNSRecord, 'id'>): Promise<DNSRecordResult> {
    try {
      console.log(`[DigitalOcean DNS] Creating ${record.type} record for ${domain}: ${record.name} -> ${record.data}`)
      
      const response = await this.client.post(`/domains/${domain}/records`, {
        type: record.type,
        name: record.name === '@' ? '' : record.name, // DO uses empty string for root
        data: record.data,
        ttl: record.ttl || 1800,
        priority: record.priority || null
      })

      const doRecord = response.data.domain_record
      return {
        id: doRecord.id.toString(),
        type: doRecord.type,
        name: doRecord.name || '@',
        data: doRecord.data,
        ttl: doRecord.ttl,
        priority: doRecord.priority || undefined
      }
    } catch (error: any) {
      console.error('[DigitalOcean DNS] Create record failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to create DNS record: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        'digitalocean'
      )
    }
  }

  async updateRecord(domain: string, recordId: string, record: Partial<DNSRecord>): Promise<DNSRecordResult> {
    try {
      console.log(`[DigitalOcean DNS] Updating record ${recordId} for ${domain}`)
      
      const updateData: any = {}
      if (record.name !== undefined) updateData.name = record.name === '@' ? '' : record.name
      if (record.data !== undefined) updateData.data = record.data
      if (record.ttl !== undefined) updateData.ttl = record.ttl
      if (record.priority !== undefined) updateData.priority = record.priority

      const response = await this.client.put(`/domains/${domain}/records/${recordId}`, updateData)

      const doRecord = response.data.domain_record
      return {
        id: doRecord.id.toString(),
        type: doRecord.type,
        name: doRecord.name || '@',
        data: doRecord.data,
        ttl: doRecord.ttl,
        priority: doRecord.priority || undefined
      }
    } catch (error: any) {
      console.error('[DigitalOcean DNS] Update record failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to update DNS record: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        'digitalocean'
      )
    }
  }

  async deleteRecord(domain: string, recordId: string): Promise<void> {
    try {
      console.log(`[DigitalOcean DNS] Deleting record ${recordId} for ${domain}`)
      
      await this.client.delete(`/domains/${domain}/records/${recordId}`)
      
      console.log(`[DigitalOcean DNS] Successfully deleted record ${recordId}`)
    } catch (error: any) {
      console.error('[DigitalOcean DNS] Delete record failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to delete DNS record: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        'digitalocean'
      )
    }
  }

  async listRecords(domain: string, type?: string): Promise<DNSRecordResult[]> {
    try {
      console.log(`[DigitalOcean DNS] Listing records for ${domain}${type ? ` (type: ${type})` : ''}`)
      
      const params: any = { per_page: 200 }
      if (type && type !== 'ALL') {
        params.type = type
      }

      const response = await this.client.get(`/domains/${domain}/records`, { params })
      
      const records = response.data.domain_records.map((doRecord: any): DNSRecordResult => ({
        id: doRecord.id.toString(),
        type: doRecord.type,
        name: doRecord.name || '@',
        data: doRecord.data,
        ttl: doRecord.ttl,
        priority: doRecord.priority || undefined
      }))

      console.log(`[DigitalOcean DNS] Found ${records.length} records`)
      return records
    } catch (error: any) {
      console.error('[DigitalOcean DNS] List records failed:', error.response?.data || error.message)
      throw new DNSProviderError(
        `Failed to list DNS records: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        'digitalocean'
      )
    }
  }

  async verifyDomainOwnership(domain: string): Promise<boolean> {
    try {
      console.log(`[DigitalOcean DNS] Verifying domain ownership for ${domain}`)
      
      // Check if domain exists in DigitalOcean
      const response = await this.client.get(`/domains/${domain}`)
      
      console.log(`[DigitalOcean DNS] Domain ${domain} ownership verified`)
      return true
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`[DigitalOcean DNS] Domain ${domain} not found in DigitalOcean`)
        return false
      }
      
      console.error('[DigitalOcean DNS] Domain verification failed:', error.message)
      throw new DNSProviderError(
        `Failed to verify domain ownership: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        'digitalocean'
      )
    }
  }

  /**
   * Get domain information
   */
  async getDomainInfo(domain: string): Promise<any> {
    try {
      const response = await this.client.get(`/domains/${domain}`)
      return response.data.domain
    } catch (error: any) {
      throw new DNSProviderError(
        `Failed to get domain info: ${error.response?.data?.message || error.message}`,
        error.response?.status || 500,
        'digitalocean'
      )
    }
  }

  /**
   * Check DNS propagation status using Google DoH API
   */
  async checkPropagation(domain: string, recordType: string, expectedValue: string): Promise<boolean> {
    try {
      console.log(`[DigitalOcean DNS] Checking propagation for ${recordType} ${domain} -> ${expectedValue}`)
      
      // Use Google DNS over HTTPS for propagation checking
      const response = await axios.get(`https://dns.google/resolve`, {
        params: {
          name: domain,
          type: recordType
        },
        timeout: 5000
      })

      if (response.data?.Status === 0 && response.data?.Answer?.length > 0) {
        const answers = response.data.Answer.filter((a: any) => 
          a.type === this.getRecordTypeNumber(recordType) && a.data === expectedValue
        )
        
        const propagated = answers.length > 0
        console.log(`[DigitalOcean DNS] Propagation check: ${propagated ? 'SUCCESS' : 'PENDING'}`)
        
        return propagated
      }

      console.log(`[DigitalOcean DNS] Propagation check: No matching records found`)
      return false
    } catch (error: any) {
      console.error('[DigitalOcean DNS] Propagation check failed:', error.message)
      return false
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