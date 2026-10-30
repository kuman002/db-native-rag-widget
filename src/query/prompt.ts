import type { RetrievedChunk } from './types.js';

export const FALLBACK_RESPONSE =
  'I apologize, but our system does not currently have information regarding that. Please contact support.';

export const DEFAULT_SIMILARITY_THRESHOLD = 0.70;

export function formatDatabaseContext(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return 'NO VERIFIED DATABASE RECORDS AVAILABLE.';
  }

  return chunks
    .map((chunk, index) => {
      return `--- Record ${index + 1} [Type: ${chunk.sourceTable}] ---\n${chunk.content.trim()}`;
    })
    .join('\n\n');
}

export function buildSystemPrompt(formattedContext: string): string {
  return `You are a verified AI assistant representing the business.
Your sole job is to answer user inquiries accurately using ONLY the verified database records provided below.

==================================================
VERIFIED DATABASE CONTEXT:
${formattedContext}
==================================================

CRITICAL RULES:
1. Answer using ONLY information explicitly stated in the context above.
2. If the context does not contain the answer or is insufficient, say exactly:
   "${FALLBACK_RESPONSE}"
3. Never mention internal database IDs, technical table names, or system parameters.
4. Be concise, polite, and directly address the user's inquiry.`;
}

export function buildUserPrompt(userQuery: string): string {
  return userQuery.trim();
}

