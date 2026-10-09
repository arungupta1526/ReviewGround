import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;
  readonly name = 'OpenAI';
  readonly defaultModel = 'gpt-4o-mini';
  readonly fallbackModels = ['gpt-4o'];

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey || process.env.OPENAI_API_KEY || '').trim();
    this.baseUrl = (baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
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
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
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
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ OpenAI API model '${model}' returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      return text && text.trim().length > 0 ? text.trim() : null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ OpenAI model '${model}' call failed: ${msg}`);
      return null;
    }
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    const primaryModel = options.model || process.env.OPENAI_MODEL || this.defaultModel;
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || this.fallbackModels[0];
    const candidateModels = Array.from(new Set([primaryModel, fallbackModel, ...this.fallbackModels])).filter(Boolean);

    for (const model of candidateModels) {
      console.log(`⚡ [ReviewGround] Calling OpenAI model '${model}'...`);
      const text = await this.callModel(model, prompt, options.temperature, options.maxTokens);

      if (text) {
        return {
          text,
          model,
          provider: this.name,
        };
      }
      console.warn(`⚠️ [ReviewGround] OpenAI '${model}' failed or produced empty output. Trying next model...`);
    }

    return null;
  }
}
