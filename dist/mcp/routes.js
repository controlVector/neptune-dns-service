"use strict";
/**
 * MCP HTTP Routes for Neptune DNS Management Agent
 *
 * These routes expose MCP tool primitives via HTTP for inference loop agents to call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpRoutes = mcpRoutes;
const zod_1 = require("zod");
const server_1 = require("./server");
// Request schemas
const MCPToolCallSchema = zod_1.z.object({
    name: zod_1.z.string().describe("Name of the MCP tool to call"),
    arguments: zod_1.z.record(zod_1.z.any()).describe("Tool arguments as key-value pairs")
});
const MCPListToolsSchema = zod_1.z.object({
// No parameters needed for listing tools
});
// MCP Routes
async function mcpRoutes(fastify) {
    // List available MCP tools
    fastify.get('/mcp/tools', async (request, reply) => {
        try {
            const tools = server_1.neptuneMCPServer.getAvailableTools();
            reply.send({
                success: true,
                tools: tools.tools,
                count: tools.tools.length,
                service: 'Neptune DNS Management Agent',
                mcp_version: '1.0.0'
            });
        }
        catch (error) {
            reply.code(500).send({
                success: false,
                error: 'Failed to list MCP tools',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    // Call an MCP tool
    fastify.post('/mcp/call', async (request, reply) => {
        try {
            const body = MCPToolCallSchema.parse(request.body);
            const result = await server_1.neptuneMCPServer.callTool(body.name, body.arguments);
            if (result.isError) {
                reply.code(400).send({
                    success: false,
                    error: 'Tool execution failed',
                    result: result,
                    tool_name: body.name
                });
            }
            else {
                reply.send({
                    success: true,
                    result: result,
                    tool_name: body.name,
                    execution_time: new Date().toISOString()
                });
            }
        }
        catch (error) {
            reply.code(400).send({
                success: false,
                error: 'Invalid MCP tool call',
                message: error instanceof Error ? error.message : 'Unknown validation error'
            });
        }
    });
    // Batch call multiple MCP tools (for complex operations)
    fastify.post('/mcp/batch', async (request, reply) => {
        try {
            const body = zod_1.z.object({
                calls: zod_1.z.array(MCPToolCallSchema).min(1).max(10).describe("Array of MCP tool calls to execute")
            }).parse(request.body);
            const results = await Promise.all(body.calls.map(async (call) => {
                try {
                    const result = await server_1.neptuneMCPServer.callTool(call.name, call.arguments);
                    return {
                        tool_name: call.name,
                        success: !result.isError,
                        result: result
                    };
                }
                catch (error) {
                    return {
                        tool_name: call.name,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }));
            const successCount = results.filter(r => r.success).length;
            const hasErrors = results.some(r => !r.success);
            reply.code(hasErrors ? 207 : 200).send({
                success: successCount === results.length,
                results: results,
                summary: {
                    total_calls: results.length,
                    successful: successCount,
                    failed: results.length - successCount
                },
                execution_time: new Date().toISOString()
            });
        }
        catch (error) {
            reply.code(400).send({
                success: false,
                error: 'Invalid MCP batch call',
                message: error instanceof Error ? error.message : 'Unknown validation error'
            });
        }
    });
    // Get tool schema for a specific tool (helpful for inference loops)
    fastify.get('/mcp/tools/:toolName/schema', async (request, reply) => {
        try {
            const { toolName } = request.params;
            const tools = server_1.neptuneMCPServer.getAvailableTools();
            const tool = tools.tools.find(t => t.name === toolName);
            if (!tool) {
                reply.code(404).send({
                    success: false,
                    error: 'Tool not found',
                    message: `MCP tool '${toolName}' is not available`,
                    available_tools: tools.tools.map(t => t.name)
                });
                return;
            }
            reply.send({
                success: true,
                tool: tool,
                usage_example: {
                    method: 'POST',
                    url: '/mcp/call',
                    body: {
                        name: tool.name,
                        arguments: {
                            // This would show example arguments based on the schema
                            example: 'See inputSchema for required parameters'
                        }
                    }
                }
            });
        }
        catch (error) {
            reply.code(500).send({
                success: false,
                error: 'Failed to get tool schema',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    // Health check specifically for MCP functionality
    fastify.get('/mcp/health', async (request, reply) => {
        try {
            const tools = server_1.neptuneMCPServer.getAvailableTools();
            // Test basic tool availability
            const availableTools = tools.tools.length;
            const expectedTools = 7; // We expect 7 MCP tools for Neptune
            reply.send({
                status: availableTools === expectedTools ? 'healthy' : 'degraded',
                mcp_server: 'operational',
                available_tools: availableTools,
                expected_tools: expectedTools,
                tools: tools.tools.map(t => t.name),
                timestamp: new Date().toISOString(),
                service: 'Neptune MCP Server'
            });
        }
        catch (error) {
            reply.code(500).send({
                status: 'unhealthy',
                mcp_server: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                service: 'Neptune MCP Server'
            });
        }
    });
}
//# sourceMappingURL=routes.js.map