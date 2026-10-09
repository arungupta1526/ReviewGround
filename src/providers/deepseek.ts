import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';

export class DeepSeekProvider implements LLMProvider {
  readonly id = 'deepseek' as const;
  readonly name = 'DeepSeek';
  readonly defaultModel = 'deepseek-chat';
  readonly fallbackModels = ['deepseek-reasoner'];

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = (apiKey || process.env.DEEPSEEK_API_KEY || '').trim();
    this.baseUrl = (baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private async callModel(
    model: string,
    prompt: string,
    temperature = 0.2,
    maxTokens = 2048
  ): Promise<{ text: string | null; reasoning?: string }> {
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
          ...(model.includes('reasoner') ? {} : { temperature }),
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ DeepSeek API model '${model}' returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return { text: null };
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            reasoning_content?: string;
          };
        }>;
      };

      const choice = data.choices?.[0]?.message;
      const text = choice?.content?.trim() || null;
      const reasoning = choice?.reasoning_content?.trim();

      return { text, reasoning };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ DeepSeek model '${model}' call failed: ${msg}`);
      return { text: null };
    }
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    // Hierarchy: 1. options.model -> 2. DEEPSEEK_MODEL / MODEL -> 3. defaultModel
    const primaryModel = options.model || process.env.DEEPSEEK_MODEL || process.env.MODEL || this.defaultModel;
    const fallbackModel = process.env.DEEPSEEK_FALLBACK_MODEL || this.fallbackModels[0];
    const candidateModels = Array.from(new Set([primaryModel, fallbackModel, ...this.fallbackModels])).filter(Boolean);

    for (const model of candidateModels) {
      console.log(`⚡ [ReviewGround] Calling DeepSeek model '${model}'...`);
      const { text, reasoning } = await this.callModel(model, prompt, options.temperature, options.maxTokens);

      if (text) {
        return {
          text,
          model,
          provider: this.name,
          reasoning,
        };
      }
      console.warn(`⚠️ [ReviewGround] DeepSeek '${model}' failed or produced empty output. Trying next model...`);
    }

    return null;
  }
}
