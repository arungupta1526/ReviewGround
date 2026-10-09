import { LLMProvider, ProviderName, ProviderResponse, ReviewOptions } from './types.js';
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GroqProvider } from './groq.js';
import { DeepSeekProvider } from './deepseek.js';
import { CustomProvider } from './custom.js';

export * from './types.js';
export { GeminiProvider } from './gemini.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { GroqProvider } from './groq.js';
export { DeepSeekProvider } from './deepseek.js';
export { CustomProvider } from './custom.js';

export interface ProviderManagerConfig {
  preferredProvider?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  deepseekApiKey?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
}

export class ProviderManager {
  private providers: LLMProvider[];
  private preferred?: string;

  constructor(config: ProviderManagerConfig = {}) {
    this.preferred = (config.preferredProvider || process.env.PROVIDER || '').trim().toLowerCase();

    this.providers = [
      new GeminiProvider(config.geminiApiKey),
      new OpenAIProvider(config.openaiApiKey),
      new AnthropicProvider(config.anthropicApiKey),
      new GroqProvider(config.groqApiKey),
      new DeepSeekProvider(config.deepseekApiKey),
      new CustomProvider(config.llmBaseUrl, config.llmApiKey),
    ];
  }

  getConfiguredProviders(): LLMProvider[] {
    return this.providers.filter((p) => p.isConfigured());
  }

  getExecutionChain(): LLMProvider[] {
    const configured = this.getConfiguredProviders();
    if (configured.length === 0) return [];

    if (this.preferred) {
      const matchIndex = configured.findIndex(
        (p) => p.id === this.preferred || p.name.toLowerCase().includes(this.preferred!)
      );
      if (matchIndex > -1) {
        // Put preferred provider first
        const [preferred] = configured.splice(matchIndex, 1);
        return [preferred, ...configured];
      }
      console.warn(`⚠️ Preferred provider '${this.preferred}' is not configured with an API key. Using auto-detected chain.`);
    }

    return configured;
  }

  async executeReview(
    prompt: string,
    options: ReviewOptions = {}
  ): Promise<ProviderResponse | null> {
    const chain = this.getExecutionChain();

    if (chain.length === 0) {
      console.log('ℹ️  No AI provider API keys detected (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, LLM_BASE_URL).');
      return null;
    }

    console.log(
      `🔎 Detected ${chain.length} available provider(s): ${chain.map((p) => p.name).join(' -> ')}`
    );

    for (const provider of chain) {
      try {
        console.log(`🤖 [ReviewGround] Attempting review with ${provider.name}...`);
        const response = await provider.review(prompt, options);
        if (response && response.text.trim().length > 0) {
          console.log(`✅ [ReviewGround] Successfully generated review via ${provider.name} (${response.model}).`);
          return response;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ [ReviewGround] Provider '${provider.name}' encountered error: ${msg}`);
      }
      console.warn(`⚠️ [ReviewGround] Provider '${provider.name}' exhausted or unavailable. Failing over to next provider...`);
    }

    console.error('❌ All configured AI providers failed to generate a review.');
    return null;
  }
}
