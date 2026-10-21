import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  serial,
  numeric,
  uniqueIndex,
  index,
  primaryKey,
  vector,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Document Vectors Store
export const documentVectors = pgTable(
  'document_vectors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    sourceTable: varchar('source_table', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 128 }).notNull(),
    content: text('content').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    metadata: jsonb('metadata').default({}),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_tenant_source_record').on(table.tenantId, table.sourceTable, table.sourceId),
    index('idx_document_vectors_embedding_hnsw').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('idx_document_vectors_tenant_lookup').on(table.tenantId, table.sourceTable),
  ]
);

// 2. Whitelist Configurations Table
export const whitelistConfigs = pgTable(
  'whitelist_configs',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    tableName: varchar('table_name', { length: 64 }).notNull(),
    whitelistedFields: jsonb('whitelisted_fields').notNull(),
    excludedFields: jsonb('excluded_fields').default([]).notNull(),
    documentTemplate: text('document_template'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.tableName] }),
  ]
);

// 3. Operational Demo Table (Products) for CDC Testing
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  retailPrice: numeric('retail_price', { precision: 10, scale: 2 }),
  stockStatus: varchar('stock_status', { length: 50 }).default('in_stock').notNull(),
  supplierCost: numeric('supplier_cost', { precision: 10, scale: 2 }),
  internalNotes: text('internal_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type DocumentVector = typeof documentVectors.$inferSelect;
export type NewDocumentVector = typeof documentVectors.$inferInsert;
export type WhitelistConfig = typeof whitelistConfigs.$inferSelect;
export type NewWhitelistConfig = typeof whitelistConfigs.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
