import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ProviderManager, detectProviderFromModel } from '../src/providers/index.js';
import { GeminiProvider } from '../src/providers/gemini.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { AnthropicProvider } from '../src/providers/anthropic.js';
import { GroqProvider } from '../src/providers/groq.js';
import { DeepSeekProvider } from '../src/providers/deepseek.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
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

    const configuredOpenRouter = new OpenRouterProvider('fake-openrouter-key');
    assert.strictEqual(configuredOpenRouter.isConfigured(), true);

    const custom = new CustomProvider('http://localhost:11434/v1');
    assert.strictEqual(custom.isConfigured(), true);
  });

  it('exposes modern defaults across all providers', () => {
    assert.strictEqual(new GeminiProvider().defaultModel, 'gemini-3.5-flash-lite');
    assert.strictEqual(new OpenAIProvider().defaultModel, 'gpt-4o-mini');
    assert.strictEqual(new AnthropicProvider().defaultModel, 'claude-3-5-haiku-20241022');
    assert.strictEqual(new GroqProvider().defaultModel, 'qwen/qwen3.8-27b');
    assert.strictEqual(new DeepSeekProvider().defaultModel, 'deepseek-chat');
    assert.strictEqual(new OpenRouterProvider().defaultModel, 'qwen/qwen-2.5-coder-32b-instruct');
    assert.strictEqual(new CustomProvider().defaultModel, 'llama3.2');
  });

  it('provides 3-4 built-in fallback models for resilience across providers', () => {
    assert.strictEqual(new GeminiProvider().fallbackModels.length >= 3, true);
    assert.strictEqual(new OpenAIProvider().fallbackModels.length >= 3, true);
    assert.strictEqual(new AnthropicProvider().fallbackModels.length >= 3, true);
    assert.strictEqual(new GroqProvider().fallbackModels.length >= 3, true);
    assert.strictEqual(new OpenRouterProvider().fallbackModels.length >= 3, true);
  });

  it('detects matching provider from model name prefixes', () => {
    assert.strictEqual(detectProviderFromModel('gemini-2.5-pro'), 'gemini');
    assert.strictEqual(detectProviderFromModel('gpt-4o'), 'openai');
    assert.strictEqual(detectProviderFromModel('claude-3-5-sonnet'), 'anthropic');
    assert.strictEqual(detectProviderFromModel('deepseek-chat'), 'deepseek');
    assert.strictEqual(detectProviderFromModel('qwen/qwen3.8-27b'), 'groq');
    assert.strictEqual(detectProviderFromModel('qwen/qwen-2.5-coder-32b-instruct'), 'openrouter');
    assert.strictEqual(detectProviderFromModel('meta-llama/llama-3.3-70b-instruct'), 'openrouter');
    assert.strictEqual(detectProviderFromModel('unknown-model'), null);
  });

  it('ProviderManager discovers configured providers in default serial order', () => {
    const manager = new ProviderManager({
      geminiApiKey: 'test-gemini',
      openaiApiKey: 'test-openai',
      groqApiKey: 'test-groq',
    });

    const chain = manager.getExecutionChain();
    assert.strictEqual(chain.length, 3);
    assert.strictEqual(chain[0].id, 'gemini');
    assert.strictEqual(chain[1].id, 'openai');
    assert.strictEqual(chain[2].id, 'groq');
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

  it('ProviderManager does NOT reroute when provider is explicitly set to custom or openrouter', () => {
    const manager = new ProviderManager({
      groqApiKey: 'test-groq',
      llmBaseUrl: 'https://api.together.xyz/v1',
      llmApiKey: 'test-together',
      preferredProvider: 'custom',
    });

    // Even though model is qwen, user explicitly chose custom endpoint (Together AI)
    const chain = manager.getExecutionChain('qwen/qwen-2.5-72b-instruct');
    assert.strictEqual(chain.length, 2);
    assert.strictEqual(chain[0].id, 'custom');
  });

  it('ProviderManager auto-detects OpenRouter from namespaced model when openrouter key exists', () => {
    const manager = new ProviderManager({
      geminiApiKey: 'test-gemini',
      openrouterApiKey: 'test-openrouter',
    });

    const chain = manager.getExecutionChain('qwen/qwen-2.5-coder-32b-instruct');
    assert.strictEqual(chain.length, 2);
    assert.strictEqual(chain[0].id, 'openrouter');
    assert.strictEqual(chain[1].id, 'gemini');
  });

  it('ProviderManager gracefully routes mismatched model if matching provider has an API key', () => {
    const manager = new ProviderManager({
      geminiApiKey: 'test-gemini',
      deepseekApiKey: 'test-deepseek',
      preferredProvider: 'gemini',
    });

    const chain = manager.getExecutionChain('deepseek-chat');
    assert.strictEqual(chain.length, 2);
    assert.strictEqual(chain[0].id, 'deepseek');
    assert.strictEqual(chain[1].id, 'gemini');
  });

  it('ProviderManager returns empty chain when no keys are provided', () => {
    const manager = new ProviderManager({});
    assert.strictEqual(manager.getConfiguredProviders().length, 0);
    assert.strictEqual(manager.getExecutionChain().length, 0);
  });
});
