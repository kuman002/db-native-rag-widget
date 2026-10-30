import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from '../../src/api/server.js';

describe('Widget Static & Demo Endpoints (Task 4)', () => {
  let server: Server;
  const port = 3458;
  const baseUrl = `http://127.0.0.1:${port}`;

  beforeAll(async () => {
    server = createServer();
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /widget.js serves the compiled bundle with JS content type', async () => {
    const res = await fetch(`${baseUrl}/widget.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/javascript');
    const text = await res.text();
    expect(text.length).toBeGreaterThan(1000);
    expect(text).toContain('db-native-rag-widget-root');
  });

  it('GET /demo serves the interactive storefront playground', async () => {
    const res = await fetch(`${baseUrl}/demo`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Operational Storefront Demo');
    expect(html).toContain('data-tenant-key="tnt_demo_store"');
  });
});

