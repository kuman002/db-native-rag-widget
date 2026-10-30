import { Worker, type Job } from 'bullmq';
import { sql, eq, and } from 'drizzle-orm';
import { db } from '../database/pool.js';
import { whitelistConfigs } from '../database/schema.js';
import { env } from '../config/env.js';
import { QUEUE_NAME } from '../ingestion/queue.js';
import type { CdcChangeEvent } from '../ingestion/types.js';
import { WhitelistSanitizationService } from '../privacy/sanitizer.js';
import { VectorRepository } from './repository.js';
import { getEmbeddingProvider, type EmbeddingProvider } from './provider.js';

export interface ProcessResult {
  status:
    | 'vectorized'
    | 'deleted'
    | 'skipped_unchanged'
    | 'skipped_no_whitelist'
    | 'skipped_not_found';
  hash?: string;
  sourceId?: string;
}

export interface VectorWorkerOptions {
  embeddingProvider?: EmbeddingProvider;
  vectorRepository?: VectorRepository;
  sanitizationService?: WhitelistSanitizationService;
  concurrency?: number;
}

export class VectorWorkerService {
  private worker: Worker<CdcChangeEvent> | null = null;
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly vectorRepo: VectorRepository;
  private readonly sanitizer: WhitelistSanitizationService;
  private readonly concurrency: number;

  constructor(options?: VectorWorkerOptions) {
    this.embeddingProvider = options?.embeddingProvider ?? getEmbeddingProvider();
    this.vectorRepo = options?.vectorRepository ?? new VectorRepository();
    this.sanitizer = options?.sanitizationService ?? new WhitelistSanitizationService();
    this.concurrency = options?.concurrency ?? 5;
  }

  public start(): void {
    if (this.worker) return;

    this.worker = new Worker<CdcChangeEvent>(
      QUEUE_NAME,
      async (job: Job<CdcChangeEvent>) => {
        return await this.processChange(job.data);
      },
      {
        connection: {
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          maxRetriesPerRequest: null,
        },
        concurrency: this.concurrency,
      }
    );

    this.worker.on('error', (err) => {
      console.error('[VectorWorkerService] Worker error:', err);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`[VectorWorkerService] Job ${job?.id} failed:`, err);
    });
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }

  public async processChange(event: CdcChangeEvent): Promise<ProcessResult> {
    // 1. Handle deletion
    if (event.operation === 'DELETE') {
      await this.vectorRepo.deleteVector(event.tenantId, event.table, event.recordId);
      return { status: 'deleted', sourceId: event.recordId };
    }

    // 2. Fetch Whitelist Config for tenant and table
    const [config] = await db
      .select()
      .from(whitelistConfigs)
      .where(
        and(
          eq(whitelistConfigs.tenantId, event.tenantId),
          eq(whitelistConfigs.tableName, event.table)
        )
      );

    if (!config) {
      // Default-deny: If no whitelist configuration is set, row is not exposed to RAG
      return { status: 'skipped_no_whitelist', sourceId: event.recordId };
    }

    // 3. Fetch source row from database
    const query = sql`SELECT * FROM ${sql.identifier(event.table)} WHERE id::text = ${event.recordId} AND tenant_id = ${event.tenantId} LIMIT 1`;
    const result = await db.execute(query);
    const rawRow = result.rows[0] as Record<string, any> | undefined;

    if (!rawRow) {
      return { status: 'skipped_not_found', sourceId: event.recordId };
    }

    // 4. Normalize row keys (both snake_case and camelCase available for whitelist matching)
    const normalizedRecord = this.normalizeRecordKeys(rawRow);

    // 5. In-memory privacy sanitization
    const sanitized = this.sanitizer.sanitize(normalizedRecord, config);

    // 6. Content-hash deduplication check
    const existingHash = await this.vectorRepo.getContentHash(
      event.tenantId,
      event.table,
      event.recordId
    );

    if (existingHash && existingHash === sanitized.contentHash) {
      return { status: 'skipped_unchanged', hash: existingHash, sourceId: event.recordId };
    }

    // 7. Generate embedding
    const embedding = await this.embeddingProvider.generateEmbedding(sanitized.sanitizedText);

    // 8. Deterministic upsert to document_vectors
    await this.vectorRepo.upsertVector({
      tenantId: event.tenantId,
      sourceTable: event.table,
      sourceId: event.recordId,
      content: sanitized.sanitizedText,
      contentHash: sanitized.contentHash,
      embedding,
      metadata: {
        includedFields: sanitized.includedFields,
        excludedFields: sanitized.excludedFields,
        operation: event.operation,
      },
    });

    return { status: 'vectorized', hash: sanitized.contentHash, sourceId: event.recordId };
  }

  private normalizeRecordKeys(record: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = { ...record };
    for (const [key, value] of Object.entries(record)) {
      // snake_to_camel
      const camel = key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
      if (camel !== key && !(camel in result)) {
        result[camel] = value;
      }
      // camel_to_snake
      const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (snake !== key && !(snake in result)) {
        result[snake] = value;
      }
    }
    return result;
  }
}
