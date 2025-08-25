/**
 * MCP (Model Context Protocol) Server for Neptune DNS Management Agent
 */
import { MCPToolResult } from './tools';
export declare class NeptuneMCPServer {
    constructor();
    /**
     * Get list of available MCP tools
     */
    getAvailableTools(): {
        tools: {
            name: string;
            description: string;
            inputSchema: import("zod").ZodObject<{
                domain: import("zod").ZodString;
                record_type: import("zod").ZodEnum<["A", "AAAA", "CNAME", "MX", "TXT"]>;
                name: import("zod").ZodString;
                content: import("zod").ZodString;
                ttl: import("zod").ZodOptional<import("zod").ZodNumber>;
                provider: import("zod").ZodEnum<["cloudflare", "digitalocean", "route53"]>;
                workspace_id: import("zod").ZodString;
                user_id: import("zod").ZodString;
                jwt_token: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                domain: string;
                record_type: "A" | "AAAA" | "CNAME" | "MX" | "TXT";
                name: string;
                content: string;
                provider: "cloudflare" | "digitalocean" | "route53";
                workspace_id: string;
                user_id: string;
                jwt_token: string;
                ttl?: number | undefined;
            }, {
                domain: string;
                record_type: "A" | "AAAA" | "CNAME" | "MX" | "TXT";
                name: string;
                content: string;
                provider: "cloudflare" | "digitalocean" | "route53";
                workspace_id: string;
                user_id: string;
                jwt_token: string;
                ttl?: number | undefined;
            }> | import("zod").ZodObject<{
                domain: import("zod").ZodString;
                record_type: import("zod").ZodEnum<["A", "AAAA", "CNAME", "MX", "TXT"]>;
                expected_value: import("zod").ZodString;
                workspace_id: import("zod").ZodString;
                user_id: import("zod").ZodString;
                jwt_token: import("zod").ZodString;
            }, "strip", import("zod").ZodTypeAny, {
                domain: string;
                record_type: "A" | "AAAA" | "CNAME" | "MX" | "TXT";
                workspace_id: string;
                user_id: string;
                jwt_token: string;
                expected_value: string;
            }, {
                domain: string;
                record_type: "A" | "AAAA" | "CNAME" | "MX" | "TXT";
                workspace_id: string;
                user_id: string;
                jwt_token: string;
                expected_value: string;
            }>;
        }[];
    };
    /**
     * Execute an MCP tool call
     */
    callTool(toolName: string, input: unknown): Promise<MCPToolResult>;
    /**
     * MCP Tool: Create DNS Record
     */
    private createDNSRecord;
    /**
     * MCP Tool: Verify DNS Propagation
     */
    private verifyDNSPropagation;
}
export declare const neptuneMCPServer: NeptuneMCPServer;
//# sourceMappingURL=server.d.ts.map