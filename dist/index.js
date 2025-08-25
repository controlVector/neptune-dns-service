"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildServer = buildServer;
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const routes_1 = require("./mcp/routes");
const PORT = parseInt(process.env.PORT || '3006');
const HOST = process.env.HOST || '0.0.0.0';
async function buildServer() {
    const fastify = (0, fastify_1.default)({
        logger: process.env.NODE_ENV === 'development'
            ? {
                level: process.env.LOG_LEVEL || 'info',
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: true
                    }
                }
            }
            : { level: process.env.LOG_LEVEL || 'info' }
    });
    // Security plugins
    await fastify.register(helmet_1.default, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
            }
        }
    });
    await fastify.register(cors_1.default, {
        origin: process.env.NODE_ENV === 'development'
            ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
            : [process.env.FRONTEND_URL || 'https://app.controlvector.io'],
        credentials: true
    });
    // Root endpoint
    fastify.get('/', async () => ({
        service: 'Neptune DNS Management Agent',
        version: '1.0.0',
        status: 'operational',
        description: 'ControlVector specialized DNS management and domain operations service',
        timestamp: new Date().toISOString(),
        capabilities: [
            'DNS record management',
            'Multi-provider DNS operations',
            'SSL certificate DNS validation',
            'Domain propagation verification',
            'DNS zone management'
        ],
        providers: ['Cloudflare', 'DigitalOcean', 'Route53'],
        endpoints: {
            dns: '/api/v1/dns',
            domains: '/api/v1/domains',
            health: '/api/v1/health',
            mcp_tools: '/api/v1/mcp/tools',
            mcp_call: '/api/v1/mcp/call',
            mcp_health: '/api/v1/mcp/health',
            docs: '/docs'
        }
    }));
    // MCP routes for DNS tool primitives
    await fastify.register(routes_1.mcpRoutes, { prefix: '/api/v1' });
    // Global error handler
    fastify.setErrorHandler((error, request, reply) => {
        request.log.error(error);
        // Handle specific error types
        if (error.name === 'ValidationError') {
            reply.code(400).send({
                error: 'Validation Error',
                message: 'Request validation failed',
                details: error.message
            });
            return;
        }
        if (error.name === 'NeptuneError') {
            reply.code(error.statusCode || 500).send({
                error: error.name,
                message: error.message,
                code: error.code
            });
            return;
        }
        // Default error response
        reply.code(500).send({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString()
        });
    });
    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
        fastify.log.info(`Received ${signal}, starting graceful shutdown...`);
        try {
            await fastify.close();
            fastify.log.info('Neptune server closed successfully');
            process.exit(0);
        }
        catch (error) {
            fastify.log.error(error, 'Error during shutdown');
            process.exit(1);
        }
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    return fastify;
}
async function start() {
    try {
        const fastify = await buildServer();
        await fastify.listen({
            port: PORT,
            host: HOST
        });
        fastify.log.info(`🌊 Neptune DNS Management Agent running on http://${HOST}:${PORT}`);
        fastify.log.info('🌐 Ready to manage DNS operations!');
        // Log environment info
        fastify.log.info('Environment configuration:');
        fastify.log.info(`- Node.js version: ${process.version}`);
        fastify.log.info(`- Environment: ${process.env.NODE_ENV || 'development'}`);
        fastify.log.info(`- Log level: ${process.env.LOG_LEVEL || 'info'}`);
        // Log provider status
        const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
        const doToken = process.env.DIGITALOCEAN_API_TOKEN;
        const awsKey = process.env.AWS_ACCESS_KEY_ID;
        fastify.log.info(`- Cloudflare: ${cloudflareToken ? 'configured' : 'not configured'}`);
        fastify.log.info(`- DigitalOcean: ${doToken ? 'configured' : 'not configured'}`);
        fastify.log.info(`- Route53: ${awsKey ? 'configured' : 'not configured'}`);
        if (!cloudflareToken && !doToken && !awsKey) {
            fastify.log.warn('⚠️  No DNS provider credentials configured.');
            fastify.log.info('💡 Neptune will still work for testing without real provider credentials.');
        }
    }
    catch (err) {
        console.error('❌ Error starting Neptune server:', err);
        process.exit(1);
    }
}
// Start server if this file is run directly
if (require.main === module) {
    start();
}
//# sourceMappingURL=index.js.map