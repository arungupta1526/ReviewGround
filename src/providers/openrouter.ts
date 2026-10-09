import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

export class OpenRouterProvider implements LLMProvider {
  readonly id = 'openrouter' as const;
  readonly name = 'OpenRouter';
  readonly defaultModel = 'qwen/qwen-2.5-coder-32b-instruct';
  readonly fallbackModels = [
    'meta-llama/llama-3.3-70b-instruct',
    'mistralai/mistral-small-24b-instruct-2501',
    'google/gemini-2.0-flash-exp:free',
    'liquid/lfm-2.5-2.6b:free',
  ];

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey || process.env.OPENROUTER_API_KEY || '').trim();
    this.baseUrl = (baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async callModel(
    model: string,
    prompt: string,
    temperature = 0.2,
    maxTokens = 2048
  ): Promise<string | null> {
    const url = `${this.baseUrl}/chat/completions`;
    try {
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/arungupta1526/ReviewGround',
          'X-Title': 'ReviewGround AI Code Reviewer',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
      }, 2, 35000);

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ OpenRouter model '${model}' returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      return text && text.trim().length > 0 ? text.trim() : null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ OpenRouter model '${model}' call failed: ${msg}`);
      return null;
    }
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    // Hierarchy: 1. options.model -> 2. OPENROUTER_MODEL / MODEL -> 3. defaultModel
    const primaryModel = options.model || process.env.OPENROUTER_MODEL || process.env.MODEL || this.defaultModel;

    // Custom fallbacks via env var or options
    const envFallbacks = (process.env.OPENROUTER_FALLBACK_MODELS || process.env.FALLBACK_MODELS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const customFallbacks = options.fallbackModels && options.fallbackModels.length > 0
      ? options.fallbackModels
      : envFallbacks;

    const activeFallbacks = customFallbacks.length > 0 ? customFallbacks : this.fallbackModels;
    const candidateModels = Array.from(new Set([primaryModel, ...activeFallbacks])).filter(Boolean);

    for (const model of candidateModels) {
      console.log(`⚡ [ReviewGround] Calling OpenRouter model '${model}'...`);
      const text = await this.callModel(model, prompt, options.temperature, options.maxTokens);

      if (text) {
        return {
          text,
          model,
          provider: this.name,
        };
      }
      console.warn(`⚠️ [ReviewGround] OpenRouter '${model}' failed or produced empty output. Trying next model...`);
    }

    return null;
  }
}
