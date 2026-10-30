import OpenAI from 'openai';
import { env } from '../config/env.js';
import type { LlmProvider } from './types.js';

export class MockLlmProvider implements LlmProvider {
  constructor(private readonly defaultResponse: string = 'This is a verified response from the database context.') {}

  async generate(prompt: string, _systemPrompt?: string): Promise<string> {
    return this.defaultResponse;
  }

  async *generateStream(prompt: string, _systemPrompt?: string): AsyncIterable<string> {
    const tokens = this.defaultResponse.split(' ');
    for (let i = 0; i < tokens.length; i++) {
      const token = i === 0 ? tokens[i] : ' ' + tokens[i];
      yield token;
    }
  }
}

export class OllamaLlmProvider implements LlmProvider {
  constructor(
    private readonly baseUrl: string = env.OLLAMA_BASE_URL || 'http://localhost:11434',
    private readonly model: string = env.LLM_MODEL || 'llama3.2:1b'
  ) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        system: systemPrompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama LLM error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  }

  async *generateStream(prompt: string, systemPrompt?: string): AsyncIterable<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        system: systemPrompt,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(`Ollama streaming error (${response.status}): ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as { response?: string; done?: boolean };
            if (parsed.response) {
              yield parsed.response;
            }
            if (parsed.done) return;
          } catch {
            // Partial JSON line, ignore and continue
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export class OpenAiCompatibleLlmProvider implements LlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: { apiKey?: string; baseURL?: string; model?: string }) {
    this.model = options.model || env.LLM_MODEL || 'llama-3.1-8b-instant';
    this.client = new OpenAI({
      apiKey: options.apiKey || env.GROQ_API_KEY || env.OPENAI_API_KEY || 'dummy_key',
      baseURL: options.baseURL || (env.LLM_PROVIDER === 'groq' ? 'https://api.groq.com/openai/v1' : undefined),
    });
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: false,
    });

    return completion.choices[0]?.message?.content || '';
  }

  async *generateStream(prompt: string, systemPrompt?: string): AsyncIterable<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  }
}

export class GeminiLlmProvider implements LlmProvider {
  constructor(
    private readonly apiKey: string = env.GEMINI_API_KEY || '',
    private readonly model: string = env.LLM_MODEL || 'gemini-1.5-flash'
  ) {}

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    const cleanModel = this.model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${this.apiKey}`;
    console.log(`[Gemini LLM] Calling Google Gemini API (model: ${cleanModel})...`);

    const body: Record<string, any> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (systemPrompt) {
      body.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Gemini API error (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async *generateStream(prompt: string, systemPrompt?: string): AsyncIterable<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    const cleanModel = this.model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    console.log(`[Gemini LLM] Streaming from Google Gemini API (model: ${cleanModel})...`);

    const body: Record<string, any> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (systemPrompt) {
      body.system_instruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Gemini API streaming error (${res.status}): ${errText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('Missing response body from Gemini API');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          try {
            const parsed = JSON.parse(jsonStr);
            const textPart = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textPart) {
              yield textPart;
            }
          } catch {
            // Ignore incomplete fragments
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export function getLlmProvider(overrideProvider?: string): LlmProvider {
  const provider = overrideProvider || env.LLM_PROVIDER || 'mock';

  switch (provider.toLowerCase()) {
    case 'mock':
      return new MockLlmProvider();
    case 'ollama':
      return new OllamaLlmProvider();
    case 'groq':
      return new OpenAiCompatibleLlmProvider({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: env.GROQ_API_KEY,
        model: env.LLM_MODEL || 'llama-3.1-8b-instant',
      });
    case 'openai':
      return new OpenAiCompatibleLlmProvider({
        apiKey: env.OPENAI_API_KEY,
        model: env.LLM_MODEL || 'gpt-4o-mini',
      });
    case 'gemini':
      return new GeminiLlmProvider(
        env.GEMINI_API_KEY,
        env.LLM_MODEL === 'llama3.2:1b' ? 'gemini-1.5-flash' : env.LLM_MODEL
      );
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

