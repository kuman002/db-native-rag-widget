# DB-Native RAG Chatbot Widget — Idea Document

## 1. Concept Summary
An embeddable RAG (Retrieval-Augmented Generation) chatbot widget that any website can install. Instead of crawling URLs or uploaded documents, it connects directly to the site's existing SQL and NoSQL databases. Only whitelisted fields are vectorized, and updates to the source data automatically trigger re-vectorization — keeping the bot's knowledge live and accurate without manual re-indexing.

## 2. Problem Statement
- Most RAG chatbot tools (Chatbase, Intercom Fin, n8n RAG templates, Cloudflare Worker RAG bots) rely on crawling public URLs or uploaded documents.
- URL/document crawling has issues: HTML/JS noise, stale content, no field-level control over what gets exposed.
- Companies are increasingly cautious about exposing private/internal data to third-party AI tools.
- There's no easy way for a site to say "answer questions using our live data, but only the parts we explicitly allow."

## 3. Proposed Solution
A widget + backend pipeline that:
1. Connects to the company's existing database (SQL or NoSQL).
2. Vectorizes only whitelisted fields/columns (privacy-first by design).
3. Automatically re-vectorizes on data change via DB triggers/CDC streams — no manual re-indexing.
4. Serves an embeddable chat widget that answers user questions using only the approved, up-to-date vectorized data.

## 4. Core Differentiator
Unlike competitors that crawl URLs or require document uploads, this connects directly to the live database and stays in sync automatically. Combined with field-level whitelisting, this gives companies a real, demonstrable privacy guarantee: internal/sensitive columns never enter the embedding pipeline at all.

## 5. Proposed Architecture (AWS & Local)

**Ingestion / Sync Layer**
- **SQL (Postgres / Aurora)**: Native DB triggers (`pg_notify`) or logical replication / DMS CDC → change events.
- **NoSQL (DynamoDB)**: DynamoDB Streams → native change events on insert/update/delete.
- Both feed into an **SQS queue** (or **Redis BullMQ** locally) for buffering and retry safety during bulk updates.

**Vectorization Layer**
- A worker process / Lambda consumes queue events.
- Reads a **field whitelist config** (per table/collection) to extract only approved fields.
- Generates embeddings (e.g., Bedrock Titan, OpenAI embeddings, or local Ollama).
- Upserts into a vector store (`pgvector` on Postgres), keyed by source record ID so updates replace rather than duplicate.
- Handles deletes: removes the corresponding vector when a source row/item is deleted.

**Query Layer**
- API Gateway / NestJS Controller → similarity search against the vector store → top-k relevant chunks → LLM generates the final answer → response returned to the widget.

**Widget**
- Lightweight JS snippet, embeddable in any website, calls the query API.

**Multi-Tenancy**
- Each company/site gets an isolated namespace (separate schema or metadata filter by `tenant_id`) to prevent cross-tenant data leakage.

## 6. Privacy / Access Control Model
- Admin explicitly whitelists which fields/columns are eligible for vectorization — this is the core privacy guarantee.
- Optional: per-user auth so logged-in users can get scoped answers (e.g., their own order data) while anonymous visitors only see public-level content.
- No raw DB access is ever exposed to the LLM — only pre-approved, pre-extracted fields.

## 7. Market Landscape (existing players)
- **Chatbase** — no-code, upload URLs/docs, embeddable widget.
- **Intercom Fin, Zendesk AI, Ada, Drift, Crisp AI** — funded enterprise players in the AI support-widget space.
- **n8n RAG templates, Lamatic.ai, CrawlAI RAG** — workflow-based crawl → embed → chat pipelines.
- **Cloudflare Workers RAG bot (rootsongjc), GrowwStacks no-code builders** — open-source/DIY embeddable widgets.
- None of the above sync directly and automatically from a live production database — this is the open gap.
