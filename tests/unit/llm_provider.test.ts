import { describe, it, expect } from 'vitest';
import {
  MockLlmProvider,
  OllamaLlmProvider,
  OpenAiCompatibleLlmProvider,
  GeminiLlmProvider,
  getLlmProvider,
} from '../../src/query/llm.js';

describe('LLM Provider Abstraction (Task 1)', () => {
  it('MockLlmProvider generates full response and stream tokens', async () => {
    const mock = new MockLlmProvider('Yes, the ergonomic chair is in stock.');
    const full = await mock.generate('Is the chair available?');
    expect(full).toBe('Yes, the ergonomic chair is in stock.');

    const tokens: string[] = [];
    for await (const chunk of mock.generateStream('Is the chair available?')) {
      tokens.push(chunk);
    }
    expect(tokens.join('')).toBe('Yes, the ergonomic chair is in stock.');
    expect(tokens.length).toBeGreaterThan(1);
  });

  it('getLlmProvider returns correct provider instances', () => {
    expect(getLlmProvider('mock')).toBeInstanceOf(MockLlmProvider);
    expect(getLlmProvider('ollama')).toBeInstanceOf(OllamaLlmProvider);
    expect(getLlmProvider('groq')).toBeInstanceOf(OpenAiCompatibleLlmProvider);
    expect(getLlmProvider('openai')).toBeInstanceOf(OpenAiCompatibleLlmProvider);
    expect(getLlmProvider('gemini')).toBeInstanceOf(GeminiLlmProvider);
    expect(() => getLlmProvider('unknown_provider')).toThrow(/Unsupported LLM provider/);
  });

  it('OllamaLlmProvider throws helpful error if server is unreachable', async () => {
    const ollama = new OllamaLlmProvider('http://127.0.0.1:99999', 'invalid-model');
    await expect(ollama.generate('hello')).rejects.toThrow();
  });
});

