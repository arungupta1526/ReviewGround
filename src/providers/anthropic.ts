import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';

interface AnthropicApiResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    type?: string;
    message?: string;
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  readonly name = 'Anthropic Claude';
  readonly defaultModel = 'claude-3-5-haiku-20241022';
  readonly fallbackModels = ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
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
    const url = 'https://api.anthropic.com/v1/messages';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          system: 'You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ Anthropic API model '${model}' returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const data = (await res.json()) as AnthropicApiResponse;
      const textBlock = data.content?.find((c) => c.type === 'text');
      const text = textBlock?.text;
      return text && text.trim().length > 0 ? text.trim() : null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Anthropic model '${model}' call failed: ${msg}`);
      return null;
    }
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    // Hierarchy: 1. options.model -> 2. ANTHROPIC_MODEL / MODEL -> 3. defaultModel
    const primaryModel = options.model || process.env.ANTHROPIC_MODEL || process.env.MODEL || this.defaultModel;
    const fallbackModel = process.env.ANTHROPIC_FALLBACK_MODEL || this.fallbackModels[0];
    const candidateModels = Array.from(new Set([primaryModel, fallbackModel, ...this.fallbackModels])).filter(Boolean);

    for (const model of candidateModels) {
      console.log(`⚡ [ReviewGround] Calling Anthropic Claude model '${model}'...`);
      const text = await this.callModel(model, prompt, options.temperature, options.maxTokens);

      if (text) {
        return {
          text,
          model,
          provider: this.name,
        };
      }
      console.warn(`⚠️ [ReviewGround] Anthropic Claude '${model}' failed or produced empty output. Trying next model...`);
    }

    return null;
  }
}
