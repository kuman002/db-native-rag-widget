import http from 'node:http';
import { checkSystemHealth } from '../database/health.js';
import { RagRetrievalEngine } from '../query/retrieval.js';
import { VectorRepository } from '../vector/repository.js';
import { getEmbeddingProvider } from '../vector/provider.js';
import { getLlmProvider } from '../query/llm.js';

export interface ServerOptions {
  port?: number;
  retrievalEngine?: RagRetrievalEngine;
}

export function createServer(options: ServerOptions = {}): http.Server {
  const engine =
    options.retrievalEngine ||
    new RagRetrievalEngine(
      new VectorRepository(),
      getEmbeddingProvider(),
      getLlmProvider()
    );

  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-Key, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      try {
        const health = await checkSystemHealth();
        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(health));
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: err?.message }));
      }
      return;
    }

    // POST /api/v1/chat/message
    if (req.method === 'POST' && url.pathname === '/api/v1/chat/message') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });

      req.on('end', async () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          const tenantKey =
            (req.headers['x-tenant-key'] as string) ||
            parsed.tenantId ||
            parsed.tenantKey ||
            'default_tenant';

          const message = parsed.message || parsed.query;
          const conversationId = parsed.conversationId;

          if (!message || typeof message !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Field "message" is required' }));
            return;
          }

          // Start Server-Sent Events (SSE) stream
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          });

          for await (const event of engine.execute({
            tenantId: tenantKey,
            message,
            conversationId,
          })) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }

          res.end();
        } catch (err: any) {
          if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err?.message || 'Invalid JSON request body' }));
          } else {
            res.write(`data: ${JSON.stringify({ event: 'error', message: err?.message })}\n\n`);
            res.end();
          }
        }
      });
      return;
    }

    // 404 for any other route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}
