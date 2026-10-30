import { and, eq } from 'drizzle-orm';
import { db, query } from '../database/pool.js';
import { documentVectors, type DocumentVector } from '../database/schema.js';

export interface UpsertVectorParams {
  tenantId: string;
  sourceTable: string;
  sourceId: string;
  content: string;
  contentHash: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface SimilarVectorResult {
  id: string;
  sourceTable: string;
  sourceId: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export class VectorRepository {
  /**
   * Deterministically upserts a document vector record.
   * If a record for (tenant_id, source_table, source_id) already exists,
   * updates content, content_hash, embedding, metadata, and updated_at in place.
   */
  async upsertVector(params: UpsertVectorParams): Promise<void> {
    await db
      .insert(documentVectors)
      .values({
        tenantId: params.tenantId,
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        content: params.content,
        contentHash: params.contentHash,
        embedding: params.embedding,
        metadata: params.metadata ?? {},
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [documentVectors.tenantId, documentVectors.sourceTable, documentVectors.sourceId],
        set: {
          content: params.content,
          contentHash: params.contentHash,
          embedding: params.embedding,
          metadata: params.metadata ?? {},
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Deletes a vector record from document_vectors by primary source coordinates.
   */
  async deleteVector(tenantId: string, sourceTable: string, sourceId: string): Promise<boolean> {
    const deleted = await db
      .delete(documentVectors)
      .where(
        and(
          eq(documentVectors.tenantId, tenantId),
          eq(documentVectors.sourceTable, sourceTable),
          eq(documentVectors.sourceId, sourceId)
        )
      )
      .returning({ id: documentVectors.id });

    return deleted.length > 0;
  }

  /**
   * Retrieves the current SHA-256 contentHash of an existing vector record for deduplication checks.
   */
  async getContentHash(tenantId: string, sourceTable: string, sourceId: string): Promise<string | null> {
    const [record] = await db
      .select({ contentHash: documentVectors.contentHash })
      .from(documentVectors)
      .where(
        and(
          eq(documentVectors.tenantId, tenantId),
          eq(documentVectors.sourceTable, sourceTable),
          eq(documentVectors.sourceId, sourceId)
        )
      );

    return record ? record.contentHash : null;
  }

  /**
   * Retrieves the complete document vector row.
   */
  async getVector(tenantId: string, sourceTable: string, sourceId: string): Promise<DocumentVector | null> {
    const [record] = await db
      .select()
      .from(documentVectors)
      .where(
        and(
          eq(documentVectors.tenantId, tenantId),
          eq(documentVectors.sourceTable, sourceTable),
          eq(documentVectors.sourceId, sourceId)
        )
      );

    return record ?? null;
  }

  /**
   * Performs cosine similarity search scoped to tenantId.
   */
  async findSimilar(
    tenantId: string,
    queryEmbedding: number[],
    topK: number = 5,
    minSimilarity: number = 0.70
  ): Promise<SimilarVectorResult[]> {
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const res = await query<{
      id: string;
      source_table: string;
      source_id: string;
      content: string;
      metadata: Record<string, any>;
      similarity: string | number;
    }>(
      `SELECT 
         id,
         source_table,
         source_id,
         content,
         metadata,
         1 - (embedding <=> $1::vector) AS similarity
       FROM document_vectors
       WHERE tenant_id = $2
         AND 1 - (embedding <=> $1::vector) >= $3
       ORDER BY embedding <=> $1::vector ASC
       LIMIT $4;`,
      [vectorString, tenantId, minSimilarity, topK]
    );

    return res.rows.map((row) => ({
      id: row.id,
      sourceTable: row.source_table,
      sourceId: row.source_id,
      content: row.content,
      metadata: row.metadata,
      similarity: typeof row.similarity === 'string' ? parseFloat(row.similarity) : Number(row.similarity),
    }));
  }
}

