import pg from 'pg';
import { env } from '../config/env.js';
import { enqueueChangeEvent } from './queue.js';
import { cdcChangeEventSchema, type CdcChangeEvent } from './types.js';

export const CDC_CHANNEL = 'rag_cdc_channel';

export class CdcListenerService {
  private client: pg.Client | null = null;
  private running = false;
  private notificationHandler: ((msg: pg.Notification) => void) | null = null;
  private eventSubscribers: Array<(event: CdcChangeEvent) => void> = [];

  onEvent(callback: (event: CdcChangeEvent) => void): () => void {
    this.eventSubscribers.push(callback);
    return () => {
      this.eventSubscribers = this.eventSubscribers.filter((cb) => cb !== callback);
    };
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.client = new pg.Client({
      host: env.POSTGRES_HOST,
      port: env.POSTGRES_PORT,
      database: env.POSTGRES_DB,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
    });

    this.client.on('error', (err) => {
      console.error('[CDC Listener] PostgreSQL client connection error:', err);
    });

    await this.client.connect();
    await this.client.query(`LISTEN ${CDC_CHANNEL};`);

    this.notificationHandler = async (msg: pg.Notification) => {
      if (msg.channel !== CDC_CHANNEL || !msg.payload) return;

      try {
        const parsed = JSON.parse(msg.payload);
        const event = cdcChangeEventSchema.parse(parsed);
        await enqueueChangeEvent(event);

        for (const sub of this.eventSubscribers) {
          try {
            sub(event);
          } catch (e) {
            console.error('[CDC Listener] Subscriber callback failed:', e);
          }
        }
      } catch (err) {
        console.error('[CDC Listener] Failed to parse or enqueue notification:', err, msg.payload);
      }
    };

    this.client.on('notification', this.notificationHandler);
    this.running = true;

    if (env.NODE_ENV !== 'test') {
      console.log(`[CDC Listener] Listening on channel '${CDC_CHANNEL}'...`);
    }
  }

  async stop(): Promise<void> {
    if (!this.running || !this.client) return;

    if (this.notificationHandler) {
      this.client.off('notification', this.notificationHandler);
      this.notificationHandler = null;
    }

    try {
      await this.client.query(`UNLISTEN ${CDC_CHANNEL};`);
      await this.client.end();
    } catch (err) {
      console.error('[CDC Listener] Error during disconnect:', err);
    } finally {
      this.client = null;
      this.running = false;
    }
  }

  isRunning(): boolean {
    return this.running;
  }
}

