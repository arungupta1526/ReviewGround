/**
 * ReviewGround - Interactive PR Slash Command Handler
 * Feature 1: Handles `issue_comment` GitHub events to process @reviewground commands
 * and /review slash commands posted by developers in PR comments.
 *
 * Supported commands:
 *   @reviewground explain   — AI explains why a flagged issue was raised
 *   @reviewground fix       — AI suggests an alternative code patch
 *   /review full            — Full comprehensive re-review
 *   /review security        — Security-focused re-review
 *   /review performance     — Performance-focused re-review
 */

import { postOrUpdatePrComment, getPullRequestDiff, DEFAULT_COMMENT_TAG } from './reviewer.js';
import { ProviderManager, ReviewOptions } from './providers/index.js';

export interface SlashCommandConfig {
  githubToken: string;
  repo: string;
  prNumber: string;
  commentBody: string;
  commentId?: number;
  commentAuthor?: string;
  commentTag?: string;
  // Provider config
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
  baseBranch?: string;
  enableSearchGrounding?: boolean;
  fallbackModels?: string[];
}

export type SlashCommandType =
  | 'explain'
  | 'fix'
  | 'review-full'
  | 'review-security'
  | 'review-performance'
  | 'review-standard'
  | null;

/**
 * Parses a PR comment body to extract a recognized ReviewGround slash command.
 */
export function parseSlashCommand(commentBody: string): SlashCommandType {
  const text = commentBody.trim().toLowerCase();

  if (/@reviewground\s+explain/i.test(text)) return 'explain';
  if (/@reviewground\s+fix/i.test(text)) return 'fix';
  if (/\/review\s+full/i.test(text)) return 'review-full';
  if (/\/review\s+security/i.test(text)) return 'review-security';
  if (/\/review\s+performance/i.test(text)) return 'review-performance';
  if (/\/review\s+standard/i.test(text)) return 'review-standard';
  if (/\/review\b/i.test(text)) return 'review-standard'; // bare /review → standard

  return null;
}

// ──────────────────────────────────────────────
// GitHub API helpers
// ──────────────────────────────────────────────

async function fetchPrReviewComment(
  repo: string,
  token: string,
  prNumber: string,
  commentTag: string
): Promise<string | null> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-SlashCommand',
  };

  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
      { headers }
    );
    if (!res.ok) break;
    const comments = (await res.json()) as Array<{ id: number; body?: string }>;
    if (comments.length === 0) break;
    const found = comments.find((c) => c.body?.includes(commentTag));
    if (found) return found.body ?? null;
    if (comments.length < 100) break;
    page++;
  }
  return null;
}

async function postDirectComment(
  body: string,
  repo: string,
  token: string,
  prNumber: string
): Promise<void> {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ReviewGround-SlashCommand',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (res.ok) {
    console.log(`✅ [SlashCmd] Posted response comment on PR #${prNumber}`);
  } else {
    console.warn(`⚠️ [SlashCmd] Failed to post response: HTTP ${res.status}`);
  }
}

// ──────────────────────────────────────────────
// Command Executors
// ──────────────────────────────────────────────

async function executeExplain(
  config: SlashCommandConfig,
  providerManager: ProviderManager,
  options: ReviewOptions,
  originalReview: string | null
): Promise<void> {
  const context = originalReview
    ? `The previous ReviewGround review found the following issues:\n\n${originalReview.slice(0, 3000)}`
    : 'No previous review context available.';

  const prompt = `You are a Principal Software Engineer conducting a PR review.

A developer has asked: "@reviewground explain"

They want to understand WHY the previously flagged issues were raised. 

${context}

Provide a clear, educational explanation (3-5 bullet points) of:
1. Why each flagged issue matters from a security/correctness/performance perspective.
2. What could go wrong if the issue is not addressed.
3. Industry best-practice context.

Keep the tone constructive and educational. Format with markdown.`;

  const response = await providerManager.executeReview(prompt, options);
  if (!response) {
    await postDirectComment(
      `> 🤖 **@reviewground explain** — Sorry, the AI provider failed to generate an explanation. Please check your API key or try again.`,
      config.repo,
      config.githubToken,
      config.prNumber
    );
    return;
  }

  const body = `### 🤖 ReviewGround — Explanation\n\n> *Responding to your \`@reviewground explain\` request*\n\n${response.text}\n\n---\n*Powered by [ReviewGround](https://github.com/arungupta1526/ReviewGround) · ${response.provider} (${response.model})*`;
  await postDirectComment(body, config.repo, config.githubToken, config.prNumber);
}

async function executeFix(
  config: SlashCommandConfig,
  providerManager: ProviderManager,
  options: ReviewOptions,
  diff: string | null,
  originalReview: string | null
): Promise<void> {
  const diffContext = diff ? diff.slice(0, 8000) : 'No diff available.';
  const reviewContext = originalReview
    ? `Previous review findings:\n${originalReview.slice(0, 2000)}`
    : '';

  const prompt = `You are a Principal Software Engineer.

A developer has asked: "@reviewground fix"

They want concrete code fix suggestions for the issues you found.

${reviewContext}

Git diff context:
\`\`\`diff
${diffContext}
\`\`\`

Provide:
1. Specific, copy-paste ready code fixes for the most critical issue(s).
2. Brief explanation of WHY this fix is correct.
3. If multiple fixes needed, address them in order of severity.

Format each fix as a fenced code block with the language identifier.`;

  const response = await providerManager.executeReview(prompt, options);
  if (!response) {
    await postDirectComment(
      `> 🤖 **@reviewground fix** — Sorry, the AI provider failed to generate a fix. Please check your API key or try again.`,
      config.repo,
      config.githubToken,
      config.prNumber
    );
    return;
  }

  const body = `### 🤖 ReviewGround — Suggested Fix\n\n> *Responding to your \`@reviewground fix\` request*\n\n${response.text}\n\n---\n*Powered by [ReviewGround](https://github.com/arungupta1526/ReviewGround) · ${response.provider} (${response.model})*`;
  await postDirectComment(body, config.repo, config.githubToken, config.prNumber);
}

async function executeOnDemandReview(
  config: SlashCommandConfig,
  providerManager: ProviderManager,
  options: ReviewOptions,
  diff: string | null,
  reviewLevel: 'full' | 'security' | 'performance' | 'standard',
  commandTag: string
): Promise<void> {
  if (!diff || diff.trim().length === 0) {
    await postDirectComment(
      `> 🤖 **ReviewGround** — Could not fetch PR diff to perform on-demand review. Please ensure the \`GITHUB_TOKEN\` has \`contents: read\` permission.`,
      config.repo,
      config.githubToken,
      config.prNumber
    );
    return;
  }

  const focusMap: Record<string, string> = {
    full: '1. Critical bugs, edge-cases, and memory leaks.\n2. Security risks (OWASP Top 10, secret leaks, injection, XSS).\n3. Performance bottlenecks.\n4. Code style, readability, naming, and documentation gaps.\n5. Test coverage gaps.',
    security: '1. Security risks ONLY: OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization, hardcoded credentials, privilege escalation, and missing authentication/authorization.',
    performance: '1. Performance bottlenecks ONLY: N+1 queries, unbounded loops, missing cache, large allocations, synchronous blocking in async contexts, unindexed DB searches, and unoptimized algorithms.',
    standard: '1. Critical bugs and edge-case regressions.\n2. Security risks (OWASP Top 10, secret leaks, injection).\n3. Performance bottlenecks.',
  };

  const focus = focusMap[reviewLevel] ?? focusMap.standard;
  const label = reviewLevel === 'full' ? '🔍 Full Comprehensive' : reviewLevel === 'security' ? '🔒 Security-Focused' : reviewLevel === 'performance' ? '⚡ Performance-Focused' : '📋 Standard';

  const prompt = `You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.
This is an on-demand ${label} review triggered via \`/review ${reviewLevel}\` slash command.

Review focus:
${focus}

If the code looks clean, respond with "✅ All changes look clean!" and a brief 2-bullet summary.

Git Diff:
\`\`\`diff
${diff.slice(0, 28000)}
\`\`\``;

  const response = await providerManager.executeReview(prompt, options);
  if (!response) {
    await postDirectComment(
      `> 🤖 **ReviewGround** — On-demand review failed. Please check your AI provider API key.`,
      config.repo,
      config.githubToken,
      config.prNumber
    );
    return;
  }

  const header = `## 🛡️ ReviewGround — ${label} Review\n*Triggered by \`/review ${reviewLevel}\` slash command · ${response.provider} (${response.model})*`;
  const body = `${header}\n\n${response.text}\n\n---\n*Powered by [ReviewGround](https://github.com/arungupta1526/ReviewGround)*`;

  // Update the sticky comment for /review commands
  await postOrUpdatePrComment(body, config.githubToken, config.repo, config.prNumber, commandTag);
}

// ──────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────

/**
 * Handles an incoming slash command from a PR issue_comment event.
 * Dispatches to the appropriate AI action and posts a response comment.
 */
export async function handleSlashCommand(config: SlashCommandConfig): Promise<void> {
  const command = parseSlashCommand(config.commentBody);
  if (!command) {
    console.log('ℹ️ [SlashCmd] No recognized ReviewGround command found in comment. Skipping.');
    return;
  }

  console.log(`⚡ [SlashCmd] Detected command: ${command} on PR #${config.prNumber}`);

  const commentTag = config.commentTag || DEFAULT_COMMENT_TAG;

  const providerManager = new ProviderManager({
    preferredProvider: config.provider,
    geminiApiKey: config.geminiApiKey,
    openaiApiKey: config.openaiApiKey,
    anthropicApiKey: config.anthropicApiKey,
    groqApiKey: config.groqApiKey,
    deepseekApiKey: config.deepseekApiKey,
    openrouterApiKey: config.openrouterApiKey,
    llmBaseUrl: config.llmBaseUrl,
    llmApiKey: config.llmApiKey,
  });

  const configuredProviders = providerManager.getConfiguredProviders();
  if (configuredProviders.length === 0) {
    await postDirectComment(
      `> ⚠️ **ReviewGround** — No AI provider API key is configured. Add \`GEMINI_API_KEY\`, \`OPENAI_API_KEY\`, or another provider key to your repository secrets.`,
      config.repo,
      config.githubToken,
      config.prNumber
    );
    return;
  }

  const options: ReviewOptions = {
    model: config.model,
    fallbackModels: config.fallbackModels,
    temperature: config.temperature ?? 0.2,
    maxTokens: config.maxTokens ?? 2048,
    enableSearchGrounding: config.enableSearchGrounding !== false,
  };

  // Fetch shared context
  const [diff, originalReview] = await Promise.all([
    getPullRequestDiff(config.repo, config.prNumber, config.githubToken, config.baseBranch || 'main').catch(() => null),
    fetchPrReviewComment(config.repo, config.githubToken, config.prNumber, commentTag).catch(() => null),
  ]);

  switch (command) {
    case 'explain':
      await executeExplain(config, providerManager, options, originalReview);
      break;

    case 'fix':
      await executeFix(config, providerManager, options, diff, originalReview);
      break;

    case 'review-full':
      await executeOnDemandReview(config, providerManager, options, diff, 'full', commentTag);
      break;

    case 'review-security':
      await executeOnDemandReview(config, providerManager, options, diff, 'security', commentTag);
      break;

    case 'review-performance':
      await executeOnDemandReview(config, providerManager, options, diff, 'performance', commentTag);
      break;

    case 'review-standard':
      await executeOnDemandReview(config, providerManager, options, diff, 'standard', commentTag);
      break;
  }
}
