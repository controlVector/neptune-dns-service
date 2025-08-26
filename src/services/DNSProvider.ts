/**
 * DNS Provider Interface for Neptune
 */

export interface DNSRecord {
  id?: string
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT'
  name: string
  data: string
  ttl: number
  priority?: number
}

export interface DNSRecordResult {
  id: string
  type: string
  name: string
  data: string
  ttl: number
  priority?: number
}

export interface DNSProvider {
  name: string
  
  /**
   * Create a new DNS record
   */
  createRecord(domain: string, record: Omit<DNSRecord, 'id'>): Promise<DNSRecordResult>
  
  /**
   * Update an existing DNS record
   */
  updateRecord(domain: string, recordId: string, record: Partial<DNSRecord>): Promise<DNSRecordResult>
  
  /**
   * Delete a DNS record
   */
  deleteRecord(domain: string, recordId: string): Promise<void>
  
  /**
   * List all DNS records for a domain
   */
  listRecords(domain: string, type?: string): Promise<DNSRecordResult[]>
  
  /**
   * Verify domain ownership
   */
  verifyDomainOwnership(domain: string): Promise<boolean>
}

export class DNSProviderError extends Error {
  constructor(message: string, public statusCode: number = 500, public provider?: string) {
    super(message)
    this.name = 'DNSProviderError'
  }
}