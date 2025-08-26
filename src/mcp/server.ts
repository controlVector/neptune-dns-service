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
  ConfigureDomainSSLSchema
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
}

// Export singleton instance
export const neptuneMCPServer = new NeptuneMCPServer()