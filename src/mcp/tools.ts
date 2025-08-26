/**
 * Neptune MCP Tools - DNS Management Operations
 */

import { z } from 'zod'

// Simple tool result type
export interface MCPToolResult {
  content: Array<{
    type: 'text'
    text: string
  }>
  isError: boolean
}

// Create an MCP result
export function createMCPResult(text: string, isError = false): MCPToolResult {
  return {
    content: [{ type: 'text', text }],
    isError
  }
}

// Tool schemas
export const CreateDNSRecordSchema = z.object({
  domain: z.string().describe('Domain name (e.g., example.com)'),
  record_type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).describe('DNS record type'),
  name: z.string().describe('Record name (subdomain or @ for root)'),
  content: z.string().describe('Record content/value'),
  ttl: z.number().optional().describe('TTL in seconds (optional)'),
  provider: z.enum(['cloudflare', 'digitalocean', 'route53']).describe('DNS provider'),
  workspace_id: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  jwt_token: z.string().describe('Authentication token')
})

export const VerifyDNSPropagationSchema = z.object({
  domain: z.string().describe('Domain name to check'),
  record_type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).describe('DNS record type'),
  expected_value: z.string().describe('Expected DNS record value'),
  workspace_id: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  jwt_token: z.string().describe('Authentication token')
})

export const UpdateDNSRecordSchema = z.object({
  record_id: z.string().describe('DNS record ID to update'),
  domain: z.string().describe('Domain name'),
  record_type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).describe('DNS record type'),
  name: z.string().describe('Record name (subdomain or @ for root)'),
  content: z.string().describe('New record content/value'),
  ttl: z.number().optional().describe('TTL in seconds (optional)'),
  provider: z.enum(['cloudflare', 'digitalocean', 'route53']).describe('DNS provider'),
  workspace_id: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  jwt_token: z.string().describe('Authentication token')
})

export const DeleteDNSRecordSchema = z.object({
  record_id: z.string().describe('DNS record ID to delete'),
  domain: z.string().describe('Domain name'),
  provider: z.enum(['cloudflare', 'digitalocean', 'route53']).describe('DNS provider'),
  workspace_id: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  jwt_token: z.string().describe('Authentication token')
})

export const ListDNSRecordsSchema = z.object({
  domain: z.string().describe('Domain name to list records for'),
  record_type: z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'ALL']).optional().describe('Filter by record type (optional)'),
  provider: z.enum(['cloudflare', 'digitalocean', 'route53']).describe('DNS provider'),
  workspace_id: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  jwt_token: z.string().describe('Authentication token')
})

export const ConfigureDomainSSLSchema = z.object({
  domain: z.string().describe('Domain name for SSL configuration'),
  ssl_validation_method: z.enum(['dns', 'http']).default('dns').describe('SSL validation method'),
  provider: z.enum(['cloudflare', 'digitalocean', 'route53']).describe('DNS provider'),
  workspace_id: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  jwt_token: z.string().describe('Authentication token')
})

// Neptune MCP Tools
export const NEPTUNE_MCP_TOOLS = [
  {
    name: 'neptune_create_dns_record',
    description: 'Create DNS A, CNAME, MX, or TXT records for domain management',
    inputSchema: CreateDNSRecordSchema
  },
  {
    name: 'neptune_update_dns_record',
    description: 'Update existing DNS records with new values or settings',
    inputSchema: UpdateDNSRecordSchema
  },
  {
    name: 'neptune_delete_dns_record',
    description: 'Delete DNS records from domain configuration',
    inputSchema: DeleteDNSRecordSchema
  },
  {
    name: 'neptune_list_dns_records',
    description: 'List all DNS records for a domain with optional filtering',
    inputSchema: ListDNSRecordsSchema
  },
  {
    name: 'neptune_verify_dns_propagation',
    description: 'Verify DNS record propagation across global DNS servers',
    inputSchema: VerifyDNSPropagationSchema
  },
  {
    name: 'neptune_configure_domain_ssl',
    description: 'Configure SSL/TLS certificates with DNS validation for domains',
    inputSchema: ConfigureDomainSSLSchema
  }
]

// Validate MCP tool input
export function validateMCPToolInput<T>(tool: any, input: unknown): T {
  try {
    return tool.inputSchema.parse(input) as T
  } catch (error) {
    throw new Error(`Invalid input for tool ${tool.name}: ${error instanceof Error ? error.message : 'Validation failed'}`)
  }
}