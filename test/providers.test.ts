import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProviderManager } from '../src/providers/index.js';
import { GeminiProvider } from '../src/providers/gemini.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';
import { GroqProvider } from '../src/providers/groq.js';
import { DeepSeekProvider } from '../src/providers/deepseek.js';
import { CustomProvider } from '../src/providers/custom.js';

describe('Multi-Provider BYOK Engine', () => {
  it('correctly reports isConfigured() based on API keys', () => {
    const emptyGemini = new GeminiProvider('');
    assert.strictEqual(emptyGemini.isConfigured(), false);

    const configuredGemini = new GeminiProvider('fake-gemini-key');
    assert.strictEqual(configuredGemini.isConfigured(), true);

    const configuredOpenAI = new OpenAIProvider('fake-openai-key');
    assert.strictEqual(configuredOpenAI.isConfigured(), true);

    const configuredAnthropic = new AnthropicProvider('fake-anthropic-key');
    assert.strictEqual(configuredAnthropic.isConfigured(), true);

    const configuredGroq = new GroqProvider('fake-groq-key');
    assert.strictEqual(configuredGroq.isConfigured(), true);

    const configuredDeepSeek = new DeepSeekProvider('fake-deepseek-key');
    assert.strictEqual(configuredDeepSeek.isConfigured(), true);

    const custom = new CustomProvider('http://localhost:11434/v1');
    assert.strictEqual(custom.isConfigured(), true);
  });

  it('ProviderManager discovers configured providers', () => {
    const manager = new ProviderManager({
      geminiApiKey: 'test-gemini',
      groqApiKey: 'test-groq',
    });

    const configured = manager.getConfiguredProviders();
    assert.strictEqual(configured.length, 2);
    assert.strictEqual(configured[0].id, 'gemini');
    assert.strictEqual(configured[1].id, 'groq');
  });

  it('ProviderManager respects preferred provider override', () => {
    const manager = new ProviderManager({
      geminiApiKey: 'test-gemini',
      groqApiKey: 'test-groq',
      preferredProvider: 'groq',
    });

    const chain = manager.getExecutionChain();
    assert.strictEqual(chain.length, 2);
    assert.strictEqual(chain[0].id, 'groq');
    assert.strictEqual(chain[1].id, 'gemini');
  });

  it('ProviderManager returns empty chain when no keys are provided', () => {
    const manager = new ProviderManager({});
    assert.strictEqual(manager.getConfiguredProviders().length, 0);
    assert.strictEqual(manager.getExecutionChain().length, 0);
  });
});
