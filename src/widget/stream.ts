import type { SseEvent } from '../query/types.js';

export interface StreamOptions {
  url: string;
  tenantKey: string;
  message: string;
  conversationId?: string;
  onEvent: (event: SseEvent) => void;
  onError?: (err: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
}

export async function fetchSseStream(options: StreamOptions): Promise<void> {
  const { url, tenantKey, message, conversationId, onEvent, onError, onComplete, signal } =
    options;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Key': tenantKey,
      },
      body: JSON.stringify({
        message,
        conversationId,
        tenantId: tenantKey,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Response body is missing or streaming not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Retain the last incomplete fragment in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr) as SseEvent;
          onEvent(parsed);
        } catch {
          // If JSON is malformed, skip to next line
        }
      }
    }

    // Process any remaining bytes in the buffer
    if (buffer.trim().startsWith('data:')) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(5).trim()) as SseEvent;
        onEvent(parsed);
      } catch {
        // Ignore trailing fragment
      }
    }

    onComplete?.();
  } catch (err: any) {
    if (signal?.aborted) return;
    if (onError) {
      onError(err instanceof Error ? err : new Error(String(err)));
    } else {
      console.error('[RAG Widget] Stream error:', err);
    }
  }
}

