/**
 * ReviewGround - Token & Cost Transparency Estimator
 * Calculates estimated prompt/completion tokens, pricing per model/provider,
 * and generates the transparency footer for sticky comments.
 */

export interface CostHistoryEntry {
  run: number;
  commitSha?: string;
  runId?: string;
  model: string;
  tokens: number;
  costUsd: number;
  timestamp?: string;
}

export interface CostEstimateInput {
  provider: string;
  model: string;
  diffLength: number;
  responseLength: number;
  latencyMs?: number;
  commitSha?: string;
  runId?: string;
  previousHistory?: CostHistoryEntry[];
}

/**
 * Model-specific blended cost estimates per 1 million tokens (USD).
 * Differentiates premium flagship models from ultra-low-cost lite models.
 */
const MODEL_SPECIFIC_COST_PER_M: Record<string, number> = {
  // Premium / Flagship models
  'claude-3-opus': 15.00,
  'claude-3-7-sonnet': 3.00,
  'claude-3-5-sonnet': 3.00,
  'gpt-4-turbo': 10.00,
  'gpt-4o': 2.50,
  'gemini-1.5-pro': 1.25,
  'gemini-2.5-pro': 1.25,
  'deepseek-reasoner': 0.55,

  // Budget / Fast models
  'claude-3-5-haiku': 0.80,
  'claude-3-haiku': 0.25,
  'gpt-4o-mini': 0.15,
  'gpt-3.5-turbo': 0.50,
  'gemini-1.5-flash': 0.075,
  'gemini-2.0-flash': 0.10,
  'gemini-2.0-flash-lite': 0.075,
  'gemini-3.5-flash-lite': 0.075,
  'gemini-3.1-flash-lite': 0.075,
  'deepseek-chat': 0.14,
  'qwen/qwen3.8-27b': 0.15,
  'qwen-2.5-coder-32b-instruct': 0.15,
  'openai/gpt-oss-120b': 0.15,
  'openai/gpt-oss-20b': 0.05,
};

/**
 * Default fallback provider pricing per 1 million tokens (USD).
 */
const PROVIDER_FALLBACK_COST_PER_M: Record<string, number> = {
  gemini: 0.10,
  openai: 0.15,
  anthropic: 0.80,
  groq: 0.06,
  deepseek: 0.14,
  openrouter: 0.10,
  custom: 0.00,
};

/**
 * Resolves the blended cost per 1M tokens based on model name first,
 * falling back to provider baseline if the model is unrecognized.
 */
export function resolveCostPerMillion(model: string, provider: string): number {
  const normalizedModel = (model || '').toLowerCase().trim();

  // 1. Direct or substring match on specific models
  if (MODEL_SPECIFIC_COST_PER_M[normalizedModel] !== undefined) {
    return MODEL_SPECIFIC_COST_PER_M[normalizedModel];
  }
  for (const [pattern, cost] of Object.entries(MODEL_SPECIFIC_COST_PER_M)) {
    if (normalizedModel.includes(pattern)) {
      return cost;
    }
  }

  // 2. Provider fallback
  const providerKey = (provider || '').toLowerCase().split(' ')[0] ?? 'custom';
  return PROVIDER_FALLBACK_COST_PER_M[providerKey] ?? 0.15;
}

/**
 * Parses previous CI run cost history from existing PR sticky comment markdown.
 */
export function parseCostHistory(body: string | null | undefined): CostHistoryEntry[] {
  if (!body) return [];
  const regex = /<!-- reviewground-cost-history:\s*(\[.*?\])\s*-->/s;
  const match = body.match(regex);
  if (!match || !match[1]) return [];
  try {
    const parsed = JSON.parse(match[1]);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (e): e is CostHistoryEntry =>
          typeof e?.run === 'number' &&
          typeof e?.costUsd === 'number' &&
          typeof e?.tokens === 'number'
      );
    }
  } catch {
    // Ignore JSON parsing errors and fall back cleanly
  }
  return [];
}

/**
 * Calculates token usage and estimated cost for an AI code review run,
 * tracking cumulative multi-run PR spend and returning a formatted markdown footer string.
 */
export function generateCostFooter(input: CostEstimateInput): string {
  const inputTokensEst = Math.ceil(input.diffLength / 4);
  const outputTokensEst = Math.ceil(input.responseLength / 4);
  const totalTokens = inputTokensEst + outputTokensEst;

  const costPerM = resolveCostPerMillion(input.model, input.provider);
  const estimatedCostUsd = (totalTokens / 1_000_000) * costPerM;
  const latencyMs = input.latencyMs ?? 0;
  const latencyStr = latencyMs > 0 ? `${(latencyMs / 1000).toFixed(1)}s` : '—';

  const history: CostHistoryEntry[] = [...(input.previousHistory ?? [])];
  const shortSha = input.commitSha ? input.commitSha.trim().slice(0, 7) : undefined;

  const currentEntry: CostHistoryEntry = {
    run: history.length + 1,
    commitSha: shortSha,
    runId: input.runId,
    model: input.model,
    tokens: totalTokens,
    costUsd: estimatedCostUsd,
    timestamp: new Date().toISOString(),
  };

  // If this exact workflow run ID was already recorded (e.g. re-run or multi-stage update), update it
  if (input.runId && history.some((h) => h.runId === input.runId)) {
    const idx = history.findIndex((h) => h.runId === input.runId);
    history[idx] = {
      ...history[idx],
      ...currentEntry,
      run: history[idx].run,
    };
  } else {
    history.push(currentEntry);
  }

  const cumulativeCostUsd = history.reduce((sum, h) => sum + h.costUsd, 0);
  const cumulativeTokens = history.reduce((sum, h) => sum + h.tokens, 0);

  const historyMeta = `\n<!-- reviewground-cost-history: ${JSON.stringify(history)} -->`;

  if (history.length <= 1) {
    return (
      `\n\n> ⚡ **ReviewGround** | Model: \`${input.model}\` | Est. Tokens: ${totalTokens.toLocaleString()} | Est. Cost: ~$${estimatedCostUsd.toFixed(4)} | Latency: ${latencyStr}  \n` +
      `> 💰 **Cumulative PR Spend: ~$${cumulativeCostUsd.toFixed(4)} (1 CI Run)**  \n` +
      `> *Saved ~$20–50/mo vs proprietary AI review bots*` +
      historyMeta
    );
  }

  // Multiple runs: Render cumulative breakdown table
  const rows = history
    .map(
      (h) =>
        `| Run #${h.run} | ${h.commitSha ? `\`${h.commitSha}\`` : '—'} | \`${h.model}\` | ${h.tokens.toLocaleString()} | ~$${h.costUsd.toFixed(4)} |`
    )
    .join('\n');

  const historyTable =
    `>\n> <details>\n` +
    `> <summary>📜 <b>Cost History per CI Run (${history.length} runs)</b></summary>\n>\n` +
    `> | Run | Commit | Model | Tokens | Cost |\n` +
    `> |:---|:---|:---|:---|:---|\n` +
    rows
      .split('\n')
      .map((r) => `> ${r}`)
      .join('\n') +
    `\n>\n> **Total Spend for PR: ~$${cumulativeCostUsd.toFixed(4)}** *(~99.9% cheaper than proprietary bots)*\n` +
    `> </details>  \n`;

  return (
    `\n\n> ⚡ **ReviewGround** | Model: \`${input.model}\` | Est. Tokens: ${totalTokens.toLocaleString()} | Est. Cost: ~$${estimatedCostUsd.toFixed(4)} (This Run) | Latency: ${latencyStr}  \n` +
    `> 💰 **Cumulative PR Spend: ~$${cumulativeCostUsd.toFixed(4)} (${history.length} CI Runs, ${cumulativeTokens.toLocaleString()} tokens total)**  \n` +
    historyTable +
    `> *Saved ~$20–50/mo vs proprietary AI review bots*` +
    historyMeta
  );
}
