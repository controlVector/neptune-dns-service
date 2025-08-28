/**
 * MCP HTTP Routes for Neptune DNS Management Agent
 * 
 * These routes expose MCP tool primitives via HTTP for inference loop agents to call.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { neptuneMCPServer } from './server'

// Request schemas
const MCPToolCallSchema = z.object({
  name: z.string().describe("Name of the MCP tool to call"),
  arguments: z.record(z.any()).describe("Tool arguments as key-value pairs")
})

const MCPListToolsSchema = z.object({
  // No parameters needed for listing tools
})

// MCP Routes
export async function mcpRoutes(fastify: FastifyInstance) {
  
  // List available MCP tools
  fastify.get('/mcp/tools', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tools = neptuneMCPServer.getAvailableTools()
      
      reply.send({
        success: true,
        tools: tools.tools,
        count: tools.tools.length,
        service: 'Neptune DNS Management Agent',
        mcp_version: '1.0.0'
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to list MCP tools',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Call an MCP tool
  fastify.post('/mcp/call', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = MCPToolCallSchema.parse(request.body)
      
      // Extract JWT token from Authorization header
      const authHeader = request.headers.authorization
      let jwtToken = 'dev-mode'
      let argumentsWithAuth = body.arguments

      if (process.env.NODE_ENV === 'development') {
        // Development mode: provide default values if missing
        argumentsWithAuth = {
          ...body.arguments,
          jwt_token: 'dev-mode',
          workspace_id: body.arguments?.workspace_id || 'dev-workspace',
          user_id: body.arguments?.user_id || 'dev-user'
        }
      } else {
        // Production mode: require authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          reply.code(401).send({
            success: false,
            error: 'Authorization required',
            message: 'Bearer token required in Authorization header'
          })
          return
        }
        
        jwtToken = authHeader.substring(7) // Remove 'Bearer ' prefix
        
        // Inject JWT token into tool arguments
        argumentsWithAuth = {
          ...body.arguments,
          jwt_token: jwtToken
        }
      }
      
      const result = await neptuneMCPServer.callTool(body.name, argumentsWithAuth)
      
      if (result.isError) {
        // Preserve original status code from DNS provider errors
        let statusCode = 400 // Default fallback
        if (result.content && result.content[0] && result.content[0].text) {
          const errorText = result.content[0].text
          if (errorText.includes('Zone not found') || errorText.includes('404')) {
            statusCode = 404
          } else if (errorText.includes('401') || errorText.includes('unauthorized')) {
            statusCode = 401
          } else if (errorText.includes('500') || errorText.includes('Internal Server Error')) {
            statusCode = 500
          }
        }
        
        reply.code(statusCode).send({
          success: false,
          error: 'Tool execution failed',
          result: result,
          tool_name: body.name
        })
      } else {
        reply.send({
          success: true,
          result: result,
          tool_name: body.name,
          execution_time: new Date().toISOString()
        })
      }
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: 'Invalid MCP tool call',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      })
    }
  })

  // Batch call multiple MCP tools (for complex operations)
  fastify.post('/mcp/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = z.object({
        calls: z.array(MCPToolCallSchema).min(1).max(10).describe("Array of MCP tool calls to execute")
      }).parse(request.body)
      
      // Extract JWT token from Authorization header
      const authHeader = request.headers.authorization
      let jwtToken = 'dev-mode'

      if (process.env.NODE_ENV !== 'development') {
        // Production mode: require authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          reply.code(401).send({
            success: false,
            error: 'Authorization required',
            message: 'Bearer token required in Authorization header'
          })
          return
        }
        
        jwtToken = authHeader.substring(7) // Remove 'Bearer ' prefix
      }
      
      const results = await Promise.all(
        body.calls.map(async (call) => {
          try {
            // Inject JWT token into each call's arguments
            const argumentsWithAuth = {
              ...call.arguments,
              jwt_token: jwtToken
            }
            const result = await neptuneMCPServer.callTool(call.name, argumentsWithAuth)
            return {
              tool_name: call.name,
              success: !result.isError,
              result: result
            }
          } catch (error) {
            return {
              tool_name: call.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      const successCount = results.filter(r => r.success).length
      const hasErrors = results.some(r => !r.success)

      reply.code(hasErrors ? 207 : 200).send({
        success: successCount === results.length,
        results: results,
        summary: {
          total_calls: results.length,
          successful: successCount,
          failed: results.length - successCount
        },
        execution_time: new Date().toISOString()
      })
    } catch (error) {
      reply.code(400).send({
        success: false,
        error: 'Invalid MCP batch call',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      })
    }
  })

  // Get tool schema for a specific tool (helpful for inference loops)
  fastify.get('/mcp/tools/:toolName/schema', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { toolName } = request.params as { toolName: string }
      const tools = neptuneMCPServer.getAvailableTools()
      
      const tool = tools.tools.find(t => t.name === toolName)
      if (!tool) {
        reply.code(404).send({
          success: false,
          error: 'Tool not found',
          message: `MCP tool '${toolName}' is not available`,
          available_tools: tools.tools.map(t => t.name)
        })
        return
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
      })
    } catch (error) {
      reply.code(500).send({
        success: false,
        error: 'Failed to get tool schema',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Health check specifically for MCP functionality
  fastify.get('/mcp/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tools = neptuneMCPServer.getAvailableTools()
      
      // Test basic tool availability
      const availableTools = tools.tools.length
      const expectedTools = 7 // We expect 7 MCP tools for Neptune
      
      reply.send({
        status: availableTools === expectedTools ? 'healthy' : 'degraded',
        mcp_server: 'operational',
        available_tools: availableTools,
        expected_tools: expectedTools,
        tools: tools.tools.map(t => t.name),
        timestamp: new Date().toISOString(),
        service: 'Neptune MCP Server'
      })
    } catch (error) {
      reply.code(500).send({
        status: 'unhealthy',
        mcp_server: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        service: 'Neptune MCP Server'
      })
    }
  })
}