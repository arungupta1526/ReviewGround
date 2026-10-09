import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';

interface GeminiApiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

interface GeminiApiResponse {
  candidates?: GeminiApiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini' as const;
  readonly name = 'Google Gemini';
  readonly defaultModel = 'gemini-3.5-flash-lite';
  readonly fallbackModels = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-3-flash-preview',
  ];

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async callModel(
    model: string,
    prompt: string,
    withTools: boolean,
    temperature = 0.2,
    maxTokens = 2048
  ): Promise<{ text: string | null; searchUsed: boolean }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const requestBody: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    if (withTools) {
      requestBody.tools = [{ googleSearch: {} }];
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        if (withTools) {
          console.warn(`ℹ️ Gemini API model '${model}' returned HTTP ${res.status} with tools. Retrying without search tools...`);
          return this.callModel(model, prompt, false, temperature, maxTokens);
        }
        const errText = await res.text();
        console.warn(`⚠️ Gemini API model '${model}' returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return { text: null, searchUsed: false };
      }

      const data = (await res.json()) as GeminiApiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return {
        text: text && text.trim().length > 0 ? text.trim() : null,
        searchUsed: withTools,
      };
    } catch (err: unknown) {
      if (withTools) {
        console.warn('ℹ️ Gemini API call with tools timed out or failed. Retrying without search tools...');
        return this.callModel(model, prompt, false, temperature, maxTokens);
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Gemini model '${model}' call failed: ${msg}`);
      return { text: null, searchUsed: false };
    }
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    // Hierarchy: 1. options.model -> 2. GEMINI_MODEL / MODEL -> 3. defaultModel
    const primaryModel = options.model || process.env.GEMINI_MODEL || process.env.MODEL || this.defaultModel;

    // User-configured custom fallbacks via env var or options
    const envFallbacks = (process.env.GEMINI_FALLBACK_MODELS || process.env.FALLBACK_MODELS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const customFallbacks = options.fallbackModels && options.fallbackModels.length > 0
      ? options.fallbackModels
      : envFallbacks;

    const activeFallbacks = customFallbacks.length > 0 ? customFallbacks : this.fallbackModels;
    const candidateModels = Array.from(new Set([primaryModel, ...activeFallbacks])).filter(Boolean);

    const enableSearch = options.enableSearchGrounding !== false;

    for (const model of candidateModels) {
      console.log(`⚡ [ReviewGround] Calling Gemini model '${model}' (Search Grounding: ${enableSearch})...`);
      const result = await this.callModel(
        model,
        prompt,
        enableSearch,
        options.temperature,
        options.maxTokens
      );

      if (result.text) {
        return {
          text: result.text,
          model,
          provider: this.name,
          searchGroundingUsed: result.searchUsed,
        };
      }
      console.warn(`⚠️ [ReviewGround] Gemini '${model}' failed or produced empty output. Trying next model...`);
    }

    return null;
  }
}
