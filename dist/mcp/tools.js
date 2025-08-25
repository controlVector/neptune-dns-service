"use strict";
/**
 * Neptune MCP Tools - DNS Management Operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NEPTUNE_MCP_TOOLS = exports.VerifyDNSPropagationSchema = exports.CreateDNSRecordSchema = void 0;
exports.createMCPResult = createMCPResult;
exports.validateMCPToolInput = validateMCPToolInput;
const zod_1 = require("zod");
// Create an MCP result
function createMCPResult(text, isError = false) {
    return {
        content: [{ type: 'text', text }],
        isError
    };
}
// Tool schemas
exports.CreateDNSRecordSchema = zod_1.z.object({
    domain: zod_1.z.string().describe('Domain name (e.g., example.com)'),
    record_type: zod_1.z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).describe('DNS record type'),
    name: zod_1.z.string().describe('Record name (subdomain or @ for root)'),
    content: zod_1.z.string().describe('Record content/value'),
    ttl: zod_1.z.number().optional().describe('TTL in seconds (optional)'),
    provider: zod_1.z.enum(['cloudflare', 'digitalocean', 'route53']).describe('DNS provider'),
    workspace_id: zod_1.z.string().describe('Workspace identifier'),
    user_id: zod_1.z.string().describe('User identifier'),
    jwt_token: zod_1.z.string().describe('Authentication token')
});
exports.VerifyDNSPropagationSchema = zod_1.z.object({
    domain: zod_1.z.string().describe('Domain name to check'),
    record_type: zod_1.z.enum(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).describe('DNS record type'),
    expected_value: zod_1.z.string().describe('Expected DNS record value'),
    workspace_id: zod_1.z.string().describe('Workspace identifier'),
    user_id: zod_1.z.string().describe('User identifier'),
    jwt_token: zod_1.z.string().describe('Authentication token')
});
// Neptune MCP Tools
exports.NEPTUNE_MCP_TOOLS = [
    {
        name: 'neptune_create_dns_record',
        description: 'Create DNS A, CNAME, MX, or TXT records for domain management',
        inputSchema: exports.CreateDNSRecordSchema
    },
    {
        name: 'neptune_verify_dns_propagation',
        description: 'Verify DNS record propagation across global DNS servers',
        inputSchema: exports.VerifyDNSPropagationSchema
    }
];
// Validate MCP tool input
function validateMCPToolInput(tool, input) {
    try {
        return tool.inputSchema.parse(input);
    }
    catch (error) {
        throw new Error(`Invalid input for tool ${tool.name}: ${error instanceof Error ? error.message : 'Validation failed'}`);
    }
}
//# sourceMappingURL=tools.js.map