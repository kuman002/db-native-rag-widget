/**
 * DB-Native RAG Widget - Core Entry Point
 */
import { createServer } from './api/server.js';
import { env } from './config/env.js';

export const VERSION = '0.1.0';

export * from './config/env.js';
export * from './database/schema.js';
export * from './database/pool.js';
export * from './database/health.js';
export * from './database/redis.js';
export * from './ingestion/types.js';
export * from './ingestion/listener.js';
export * from './ingestion/queue.js';
export * from './privacy/sanitizer.js';
export * from './vector/provider.js';
export * from './vector/repository.js';
export * from './vector/worker.js';
export * from './query/types.js';
export * from './query/llm.js';
export * from './query/prompt.js';
export * from './query/retrieval.js';
export * from './api/server.js';

export function startApiServer(port: number = 3000) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`[RAG Gateway] Server listening on port ${port} (Environment: ${env.NODE_ENV})`);
    console.log(`[RAG Gateway] Health endpoint: http://localhost:${port}/health`);
    console.log(`[RAG Gateway] Chat endpoint: POST http://localhost:${port}/api/v1/chat/message`);
  });
  return server;
}

// Auto-start server in development / production when run as entry file
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startApiServer(3000);
}
