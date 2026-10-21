CREATE TABLE "document_vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"source_table" varchar(64) NOT NULL,
	"source_id" varchar(128) NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100),
	"retail_price" numeric(10, 2),
	"stock_status" varchar(50) DEFAULT 'in_stock' NOT NULL,
	"supplier_cost" numeric(10, 2),
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whitelist_configs" (
	"tenant_id" varchar(64) NOT NULL,
	"table_name" varchar(64) NOT NULL,
	"whitelisted_fields" jsonb NOT NULL,
	"excluded_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"document_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whitelist_configs_tenant_id_table_name_pk" PRIMARY KEY("tenant_id","table_name")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tenant_source_record" ON "document_vectors" USING btree ("tenant_id","source_table","source_id");--> statement-breakpoint
CREATE INDEX "idx_document_vectors_embedding_hnsw" ON "document_vectors" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_document_vectors_tenant_lookup" ON "document_vectors" USING btree ("tenant_id","source_table");