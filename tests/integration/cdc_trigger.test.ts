import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { env } from '../../src/config/env.js';
import { pool } from '../../src/database/pool.js';

describe('Postgres CDC Mutation Triggers (Task 2)', () => {
  let listenerClient: pg.Client;

  beforeAll(async () => {
    listenerClient = new pg.Client({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
    });
    await listenerClient.connect();
    await listenerClient.query('LISTEN rag_cdc_channel;');
  });

  afterAll(async () => {
    await listenerClient.end();
  });

  it('emits NOTIFY events on INSERT, UPDATE, and DELETE in products table', async () => {
    const receivedEvents: Array<{
      tenantId: string;
      table: string;
      operation: string;
      recordId: string;
      timestamp: string;
    }> = [];

    const notificationPromise = (count: number) =>
      new Promise<void>((resolve) => {
        const handler = (msg: pg.Notification) => {
          if (msg.channel === 'rag_cdc_channel' && msg.payload) {
            receivedEvents.push(JSON.parse(msg.payload));
            if (receivedEvents.length >= count) {
              listenerClient.off('notification', handler);
              resolve();
            }
          }
        };
        listenerClient.on('notification', handler);
      });

    // 1. INSERT
    const insertDone = notificationPromise(1);
    const insertRes = await pool.query(
      `INSERT INTO products (tenant_id, name, category, retail_price)
       VALUES ('tenant_cdc_test', 'Test Chair', 'Office', 199.99)
       RETURNING id;`
    );
    const productId = insertRes.rows[0].id.toString();
    await insertDone;

    expect(receivedEvents[0]).toMatchObject({
      tenantId: 'tenant_cdc_test',
      table: 'products',
      operation: 'INSERT',
      recordId: productId,
    });

    // 2. UPDATE
    const updateDone = notificationPromise(2);
    await pool.query(
      `UPDATE products SET retail_price = 179.99 WHERE id = $1;`,
      [productId]
    );
    await updateDone;

    expect(receivedEvents[1]).toMatchObject({
      tenantId: 'tenant_cdc_test',
      table: 'products',
      operation: 'UPDATE',
      recordId: productId,
    });

    // 3. DELETE
    const deleteDone = notificationPromise(3);
    await pool.query(
      `DELETE FROM products WHERE id = $1;`,
      [productId]
    );
    await deleteDone;

    expect(receivedEvents[2]).toMatchObject({
      tenantId: 'tenant_cdc_test',
      table: 'products',
      operation: 'DELETE',
      recordId: productId,
    });
  });
});
