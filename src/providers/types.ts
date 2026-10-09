export type ProviderName =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'custom';

export interface ProviderResponse {
  text: string;
  model: string;
  provider: string;
  searchGroundingUsed?: boolean;
  reasoning?: string;
}

export interface ReviewOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableSearchGrounding?: boolean;
}

export interface LLMProvider {
  readonly id: ProviderName;
  readonly name: string;
  readonly defaultModel: string;
  readonly fallbackModels?: string[];

  isConfigured(): boolean;
  review(prompt: string, options?: ReviewOptions): Promise<ProviderResponse | null>;
}
