import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
          const conversationId = parsed.conversationId || `conv_${Date.now()}`;

          console.log(`[HTTP Server] --> POST /api/v1/chat/message from tenant="${tenantKey}"`);
          console.log(`[HTTP Server]     Query: "${message}"`);

          if (!message || typeof message !== 'string') {
            console.warn(`[HTTP Server] <-- 400 Bad Request: missing "message" parameter`);
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

          console.log(`[HTTP Server] <-- 200 OK (SSE stream completed for conversation: ${conversationId})`);
          res.end();
        } catch (err: any) {
          console.error(`[HTTP Server] <-- Error handling /api/v1/chat/message:`, err);
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

    // GET /widget.js
    if (req.method === 'GET' && url.pathname === '/widget.js') {
      try {
        const filePath = path.join(process.cwd(), 'public', 'widget.js');
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          });
          res.end(content);
          return;
        }
      } catch (e) {
        // Fallback to 404 below
      }
    }

    // GET / or /demo
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/demo')) {
      try {
        const filePath = path.join(process.cwd(), 'public', 'demo.html');
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });
          res.end(content);
          return;
        }
      } catch (e) {
        // Fallback to 404 below
      }
    }

    // 404 for any other route
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}
