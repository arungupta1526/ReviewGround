/**
 * ReviewGround - Token & Cost Transparency Estimator
 * Calculates estimated prompt/completion tokens, pricing per provider,
 * and generates the transparency footer for sticky comments.
 */

export interface CostEstimateInput {
  provider: string;
  model: string;
  diffLength: number;
  responseLength: number;
  latencyMs?: number;
}

const COST_PER_MILLION_TOKENS: Record<string, number> = {
  gemini: 0.10,
  openai: 0.15,
  anthropic: 0.80,
  groq: 0.06,
  deepseek: 0.14,
  openrouter: 0.10,
  custom: 0.00,
};

/**
 * Calculates token usage and estimated cost for an AI code review run,
 * returning a formatted markdown footer string.
 */
export function generateCostFooter(input: CostEstimateInput): string {
  const inputTokensEst = Math.ceil(input.diffLength / 4);
  const outputTokensEst = Math.ceil(input.responseLength / 4);
  const totalTokens = inputTokensEst + outputTokensEst;

  const providerKey = input.provider.toLowerCase().split(' ')[0] ?? 'custom';
  const costPerM = COST_PER_MILLION_TOKENS[providerKey] ?? 0.15;
  const estimatedCostUsd = (totalTokens / 1_000_000) * costPerM;
  const latencyMs = input.latencyMs ?? 0;
  const latencyStr = latencyMs > 0 ? `${(latencyMs / 1000).toFixed(1)}s` : '—';

  return `\n\n> ⚡ **ReviewGround** | Model: \`${input.model}\` | Est. Tokens: ${totalTokens.toLocaleString()} | Est. Cost: ~$${estimatedCostUsd.toFixed(4)} | Latency: ${latencyStr}  \n> *Saved ~$20–50/mo vs proprietary AI review bots*`;
}
