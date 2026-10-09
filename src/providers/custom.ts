import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';

export class CustomProvider implements LLMProvider {
  readonly id = 'custom' as const;
  readonly name = 'Custom Endpoint';
  readonly defaultModel = 'llama3.2';

  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '');
    this.apiKey = (apiKey || process.env.LLM_API_KEY || '').trim();
  }

  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    // Hierarchy: 1. options.model -> 2. LLM_MODEL / MODEL -> 3. defaultModel
    const model = options.model || process.env.LLM_MODEL || process.env.MODEL || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    try {
      console.log(`⚡ [ReviewGround] Calling Custom OpenAI-compatible endpoint (${this.baseUrl}, model: '${model}')...`);
      const res = await fetch(url, {
        method: 'POST',
        headers,
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
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 2048,
        }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ Custom API endpoint returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return null;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      return text && text.trim().length > 0
        ? {
            text: text.trim(),
            model,
            provider: `Custom (${this.baseUrl})`,
          }
        : null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Custom endpoint call failed: ${msg}`);
      return null;
    }
  }
}
