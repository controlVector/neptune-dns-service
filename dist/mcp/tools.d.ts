/**
 * Neptune MCP Tools - DNS Management Operations
 */
import { z } from 'zod';
export interface MCPToolResult {
    content: Array<{
        type: 'text';
        text: string;
    }>;
    isError: boolean;
}
export declare function createMCPResult(text: string, isError?: boolean): MCPToolResult;
export declare const CreateDNSRecordSchema: z.ZodObject<{
    domain: z.ZodString;
    record_type: z.ZodEnum<["A", "AAAA", "CNAME", "MX", "TXT"]>;
    name: z.ZodString;
    content: z.ZodString;
    ttl: z.ZodOptional<z.ZodNumber>;
    provider: z.ZodEnum<["cloudflare", "digitalocean", "route53"]>;
    workspace_id: z.ZodString;
    user_id: z.ZodString;
    jwt_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
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
}>;
export declare const VerifyDNSPropagationSchema: z.ZodObject<{
    domain: z.ZodString;
    record_type: z.ZodEnum<["A", "AAAA", "CNAME", "MX", "TXT"]>;
    expected_value: z.ZodString;
    workspace_id: z.ZodString;
    user_id: z.ZodString;
    jwt_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
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
export declare const NEPTUNE_MCP_TOOLS: ({
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        domain: z.ZodString;
        record_type: z.ZodEnum<["A", "AAAA", "CNAME", "MX", "TXT"]>;
        name: z.ZodString;
        content: z.ZodString;
        ttl: z.ZodOptional<z.ZodNumber>;
        provider: z.ZodEnum<["cloudflare", "digitalocean", "route53"]>;
        workspace_id: z.ZodString;
        user_id: z.ZodString;
        jwt_token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
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
    }>;
} | {
    name: string;
    description: string;
    inputSchema: z.ZodObject<{
        domain: z.ZodString;
        record_type: z.ZodEnum<["A", "AAAA", "CNAME", "MX", "TXT"]>;
        expected_value: z.ZodString;
        workspace_id: z.ZodString;
        user_id: z.ZodString;
        jwt_token: z.ZodString;
    }, "strip", z.ZodTypeAny, {
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
})[];
export declare function validateMCPToolInput<T>(tool: any, input: unknown): T;
//# sourceMappingURL=tools.d.ts.map