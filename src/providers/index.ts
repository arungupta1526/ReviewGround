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

/**
 * Detects matching provider from common model name prefixes.
 */
export function detectProviderFromModel(modelName?: string): ProviderName | null {
  if (!modelName) return null;
  const lower = modelName.trim().toLowerCase();
  if (lower.startsWith('gemini')) return 'gemini';
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('chatgpt')) return 'openai';
  if (lower.startsWith('claude')) return 'anthropic';
  if (lower.startsWith('deepseek')) return 'deepseek';
  if (lower.startsWith('llama') || lower.startsWith('qwen') || lower.startsWith('mixtral')) return 'groq';
  return null;
}

export class ProviderManager {
  private providers: LLMProvider[];
  private preferred?: string;

  constructor(config: ProviderManagerConfig = {}) {
    this.preferred = (config.preferredProvider || process.env.PROVIDER || '').trim().toLowerCase();

    // Default hierarchy when multiple keys are configured:
    // 1. Gemini (Search Grounding & high rate-limits)
    // 2. OpenAI
    // 3. Anthropic
    // 4. Groq LPU (Ultra-fast)
    // 5. DeepSeek
    // 6. Custom
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

  getExecutionChain(modelOverride?: string): LLMProvider[] {
    const configured = this.getConfiguredProviders();
    if (configured.length === 0) return [];

    let targetProvider = this.preferred;

    // Smart Model-to-Provider resolution:
    // If a model is specified, detect if it belongs to a specific provider
    const detectedFromModel = detectProviderFromModel(modelOverride);
    if (detectedFromModel) {
      if (!targetProvider) {
        // Model provided without explicit provider -> prioritize detected provider
        targetProvider = detectedFromModel;
        console.log(`💡 [ReviewGround] Auto-detected provider '${detectedFromModel}' from model '${modelOverride}'.`);
      } else if (targetProvider !== detectedFromModel) {
        // Mismatch: e.g. provider='gemini' but model='deepseek-chat'
        const hasMatchingProvider = configured.some((p) => p.id === detectedFromModel);
        if (hasMatchingProvider) {
          console.warn(
            `⚠️ [ReviewGround] Model '${modelOverride}' matches provider '${detectedFromModel}', but provider was specified as '${targetProvider}'. Automatically routing to '${detectedFromModel}' for compatibility.`
          );
          targetProvider = detectedFromModel;
        } else {
          console.warn(
            `⚠️ [ReviewGround] Model '${modelOverride}' matches provider '${detectedFromModel}', but no API key is configured for '${detectedFromModel}'. Falling back to '${targetProvider}' default chain.`
          );
        }
      }
    }

    if (targetProvider) {
      const matchIndex = configured.findIndex(
        (p) => p.id === targetProvider || p.name.toLowerCase().includes(targetProvider!)
      );
      if (matchIndex > -1) {
        const [preferred] = configured.splice(matchIndex, 1);
        return [preferred, ...configured];
      }
      console.warn(`⚠️ Preferred provider '${targetProvider}' is not configured with an API key. Using auto-detected chain.`);
    }

    return configured;
  }

  async executeReview(
    prompt: string,
    options: ReviewOptions = {}
  ): Promise<ProviderResponse | null> {
    const chain = this.getExecutionChain(options.model);

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
