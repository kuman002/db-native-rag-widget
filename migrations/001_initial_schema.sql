-- Enable pgvector and uuid extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Document Vectors Store
CREATE TABLE IF NOT EXISTS document_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(64) NOT NULL,
  source_table VARCHAR(64) NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Deterministic single-record constraint per tenant/source
  CONSTRAINT uq_tenant_source_record UNIQUE (tenant_id, source_table, source_id)
);

-- HNSW Vector Index for High-Speed Cosine Similarity Search
CREATE INDEX IF NOT EXISTS idx_document_vectors_embedding_hnsw 
ON document_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Tenant Isolation Composite Index
CREATE INDEX IF NOT EXISTS idx_document_vectors_tenant_lookup
ON document_vectors (tenant_id, source_table);

-- 2. Whitelist Configurations Table
CREATE TABLE IF NOT EXISTS whitelist_configs (
  tenant_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(64) NOT NULL,
  whitelisted_fields JSONB NOT NULL,
  excluded_fields JSONB DEFAULT '[]'::jsonb,
  document_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (tenant_id, table_name)
);

-- 3. Operational Demo Table (Products) for CDC Testing
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  retail_price NUMERIC(10, 2),
  stock_status VARCHAR(50) DEFAULT 'in_stock',
  supplier_cost NUMERIC(10, 2),
  internal_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
