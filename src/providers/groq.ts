import { LLMProvider, ProviderResponse, ReviewOptions } from './types.js';

export class GroqProvider implements LLMProvider {
  readonly id = 'groq' as const;
  readonly name = 'Groq LPU';
  readonly defaultModel = 'llama-3.3-70b-versatile';
  readonly fallbackModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'];

  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.GROQ_API_KEY || '').trim();
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
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    // Groq free/on-demand tier has token rate limits; cap prompt characters safely
    const safePrompt =
      prompt.length > 16000
        ? prompt.slice(0, 16000) + '\n\n...[diff truncated for Groq token limit]'
        : prompt;

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
              content: safePrompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`⚠️ Groq API model '${model}' returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
        return { text: null };
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            reasoning?: string;
          };
        }>;
      };

      const choice = data.choices?.[0]?.message;
      const text =
        choice?.content && choice.content.trim().length > 0
          ? choice.content.trim()
          : choice?.reasoning && choice.reasoning.trim().length > 0
            ? choice.reasoning.trim()
            : null;

      return {
        text,
        reasoning: choice?.reasoning,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Groq model '${model}' call failed: ${msg}`);
      return { text: null };
    }
  }

  async review(prompt: string, options: ReviewOptions = {}): Promise<ProviderResponse | null> {
    if (!this.isConfigured()) return null;

    const primaryModel = options.model || process.env.GROQ_MODEL || this.defaultModel;
    const fallbackModel = process.env.GROQ_FALLBACK_MODEL || this.fallbackModels[0];
    const candidateModels = Array.from(new Set([primaryModel, fallbackModel, ...this.fallbackModels])).filter(Boolean);

    for (const model of candidateModels) {
      console.log(`⚡ [ReviewGround] Calling Groq LPU model '${model}'...`);
      const { text, reasoning } = await this.callModel(model, prompt, options.temperature, options.maxTokens);

      if (text) {
        return {
          text,
          model,
          provider: this.name,
          reasoning,
        };
      }
      console.warn(`⚠️ [ReviewGround] Groq model '${model}' failed or produced empty output. Trying next model...`);
    }

    return null;
  }
}
