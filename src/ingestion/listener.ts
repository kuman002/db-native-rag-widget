import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { parseCdcPayload, CdcChangeEvent } from './types.js';
import { enqueueCdcEvent, closeQueue } from './queue.js';

const { Client } = pg;

export type CdcEventListener = (event: CdcChangeEvent) => void | Promise<void>;

export class CdcListenerService {
  private client: pg.Client | null = null;
  private isRunning = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private listeners: Set<CdcEventListener> = new Set();

  /**
   * Registers a subscriber callback for received CDC events (useful for testing and auditing).
   */
  public onEvent(callback: CdcEventListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Starts the CDC Listener and subscribes to PostgreSQL NOTIFY events.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.connectAndListen();
  }

  /**
   * Stops the CDC Listener and cleans up connections.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.query(`UNLISTEN ${env.CDC_CHANNEL};`);
      } catch {
        // Ignore unlisten errors during teardown
      }

      try {
        await this.client.end();
      } catch {
        // Ignore end errors during teardown
      }
      this.client = null;
    }
  }

  /**
   * Checks whether the listener is actively connected and listening.
   */
  public isActive(): boolean {
    return this.isRunning && this.client !== null;
  }

  private async connectAndListen(): Promise<void> {
    try {
      this.client = new Client({
        host: env.POSTGRES_HOST,
        port: env.POSTGRES_PORT,
        database: env.POSTGRES_DB,
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
      });

      this.client.on('error', (err) => {
        console.error('[CDC Listener] Client connection error:', err.message);
        this.scheduleReconnect();
      });

      this.client.on('end', () => {
        if (this.isRunning) {
          console.warn('[CDC Listener] Connection closed unexpectedly. Scheduling reconnect...');
          this.scheduleReconnect();
        }
      });

      this.client.on('notification', async (msg) => {
        if (msg.channel !== env.CDC_CHANNEL || !msg.payload) return;

        const event = parseCdcPayload(msg.payload);
        if (!event) return;

        try {
          // 1. Push to Redis BullMQ queue with debouncing
          const jobId = await enqueueCdcEvent(event);
          console.log(`[CDC Listener] Enqueued event ${event.operation} on ${event.table}:${event.recordId} (jobId: ${jobId})`);

          // 2. Notify any local in-memory event subscribers
          for (const listener of this.listeners) {
            try {
              await listener(event);
            } catch (listenerErr) {
              console.error('[CDC Listener] Subscriber callback failed:', listenerErr);
            }
          }
        } catch (queueErr) {
          console.error('[CDC Listener] Failed to process event into queue:', queueErr);
        }
      });

      await this.client.connect();
      await this.client.query(`LISTEN ${env.CDC_CHANNEL};`);
      this.retryCount = 0;
      console.log(`[CDC Listener] Actively listening on PostgreSQL channel: "${env.CDC_CHANNEL}"`);
    } catch (err) {
      console.error('[CDC Listener] Connection failed:', (err as Error).message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.reconnectTimer) return;

    if (this.client) {
      this.client.removeAllListeners();
      this.client = null;
    }

    const backoffMs = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
    this.retryCount++;
    console.log(`[CDC Listener] Reconnecting in ${backoffMs}ms (attempt ${this.retryCount})...`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.isRunning) {
        await this.connectAndListen();
      }
    }, backoffMs);
  }
}

// Export singleton instance
export const cdcListener = new CdcListenerService();

// Support direct command line execution
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  console.log('[CDC Listener] Starting standalone CDC Listener daemon...');

  cdcListener.start().catch((err) => {
    console.error('[CDC Listener] Fatal error starting daemon:', err);
    process.exit(1);
  });

  const shutdown = async () => {
    console.log('\n[CDC Listener] Gracefully shutting down daemon...');
    await cdcListener.stop();
    await closeQueue();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
