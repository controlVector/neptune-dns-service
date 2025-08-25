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

// Neptune MCP Tools
export const NEPTUNE_MCP_TOOLS = [
  {
    name: 'neptune_create_dns_record',
    description: 'Create DNS A, CNAME, MX, or TXT records for domain management',
    inputSchema: CreateDNSRecordSchema
  },
  {
    name: 'neptune_verify_dns_propagation',
    description: 'Verify DNS record propagation across global DNS servers',
    inputSchema: VerifyDNSPropagationSchema
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