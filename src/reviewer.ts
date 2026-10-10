/**
 * ReviewGround - Universal AI Code Reviewer & Security Advisor
 * Analyzes Git diffs using Multi-Provider BYOK (Gemini, OpenAI, Anthropic, Groq, DeepSeek, Custom)
 * with multi-ecosystem registry grounding, smart diff prioritization, 1-click inline commit
 * suggestions, OWASP/CWE taxonomy tagging, token cost transparency, and sticky comments.
 */

import * as fs from 'fs';
import { ProviderManager, ProviderResponse, ReviewOptions } from './providers/index.js';
import { verifyPackagesMultiRegistry } from './packageRegistry.js';
import { packPrioritizedDiff } from './diffPrioritizer.js';
import { analyzeTestCoverage } from './testCoverageDetector.js';
import { runPrDescribe } from './prDescriber.js';
import { buildReviewPrompt } from './prompts/index.js';
import { generateCostFooter, parseCostHistory, CostHistoryEntry } from './metrics/index.js';
import {
  DEFAULT_COMMENT_TAG,
  CI_SECTION_HEADER,
  InlineSuggestionSchema,
  InlineSuggestionsListSchema,
  InlineSuggestion,
  getPullRequestDiff,
  postInlineSuggestions,
  postOrUpdatePrComment,
  fetchPrReviewComment,
  updatePrDescription,
  createCheckRun,
  prunePreviousInlineComments,
} from './github/index.js';

// Re-export GitHub commenting & diff helpers for backward compatibility
export {
  DEFAULT_COMMENT_TAG,
  CI_SECTION_HEADER,
  InlineSuggestionSchema,
  InlineSuggestionsListSchema,
  InlineSuggestion,
  getPullRequestDiff,
  postInlineSuggestions,
  postOrUpdatePrComment,
  updatePrDescription,
  createCheckRun,
  prunePreviousInlineComments,
};

/**
 * Truncates a git diff at a clean hunk boundary (on a `diff --git` line)
 * to avoid sending malformed diffs to LLMs.
 */
export function truncateDiffClean(diff: string, maxChars = 32000): string {
  if (diff.length <= maxChars) return diff;
  const truncated = diff.slice(0, maxChars);
  const lastHunkBoundary = truncated.lastIndexOf('\ndiff --git');
  if (lastHunkBoundary > 0) {
    return truncated.slice(0, lastHunkBoundary) + '\n\n... [diff truncated at clean boundary — large PR with many files] ...';
  }
  return truncated + '\n\n... [diff truncated — very large single-file change] ...';
}

export interface ReviewerConfig {
  githubToken?: string;
  repo?: string;
  prNumber?: string;
  runId?: string;
  baseBranch?: string;
  provider?: string;
  model?: string;
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
  reviewLevel?: 'critical' | 'standard' | 'comprehensive';
  reviewLanguage?: string;
  ignorePatterns?: string[];
  enableSearchGrounding?: boolean;
  enableInlineSuggestions?: boolean;
  enablePruneInlineSuggestions?: boolean;
  enableNpmVerify?: boolean;
  enablePrDescriptionUpdate?: boolean;
  generatePrDescription?: boolean;
  enableCheckRun?: boolean;
  enableMultiRegistryVerify?: boolean;
  enableCostFooter?: boolean;
  enableSmartDiffPriority?: boolean;
  enableOwaspTagging?: boolean;
  enableTestCoverageCheck?: boolean;
  commentTag?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  llmBaseUrl?: string;
  llmApiKey?: string;
}

/**
 * @deprecated Use verifyPackagesMultiRegistry from packageRegistry.ts instead.
 * Kept for backward compatibility with existing tests.
 */
export async function verifyPackagesInDiff(diffText: string): Promise<string[]> {
  const result = await verifyPackagesMultiRegistry(diffText);
  return result.notes;
}

/**
 * Filters diff hunks against glob-like ignore patterns.
 */
function applyIgnorePatterns(diff: string, ignorePatterns?: string[]): string | null {
  if (!ignorePatterns || ignorePatterns.length === 0) return diff;
  const patterns = ignorePatterns.map((p) => p.trim()).filter(Boolean);
  const hunkBlocks = diff.split(/(?=^diff --git)/m);
  const filtered = hunkBlocks.filter((block) => {
    const fileHeader = block.match(/^diff --git a\/(.+?) b\//m);
    if (!fileHeader) return true;
    const filePath = fileHeader[1];
    return !patterns.some((pattern) => {
      const regex = new RegExp(
        '^' + pattern.replace(/\*\*/g, '.+').replace(/\*/g, '[^/]+').replace(/\./g, '\\.') + '$'
      );
      return regex.test(filePath);
    });
  });
  if (hunkBlocks.length !== filtered.length) {
    console.log(`🛡️ Ignored ${hunkBlocks.length - filtered.length} file(s) matching ignore-patterns: [${patterns.join(', ')}]`);
  }
  const result = filtered.join('');
  return result && result.trim().length > 0 ? result : null;
}

/**
 * Main review execution function.
 */
export async function runReview(config: ReviewerConfig = {}): Promise<ProviderResponse | null> {
  const token = (config.githubToken || process.env.GITHUB_TOKEN || '').trim();
  const repo = (config.repo || process.env.REPO_FULL_NAME || process.env.GITHUB_REPOSITORY || '').trim();
  const prNumber = (config.prNumber || process.env.PR_NUMBER || '').trim();
  const commentTag = config.commentTag || DEFAULT_COMMENT_TAG;

  // Detect and gracefully skip automated bot PRs (e.g. dependabot[bot])
  const isBot =
    process.env.GITHUB_ACTOR?.includes('dependabot') ||
    process.env.GITHUB_ACTOR?.includes('bot');
  if (isBot) {
    console.log(`ℹ️  Automated AI review skipped for bot PR (${process.env.GITHUB_ACTOR || 'bot'}): GitHub Actions restricts repository secrets for automated bots.`);
    return null;
  }

  // Initialize Provider Manager
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
    console.log('ℹ️  No AI provider API keys configured (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, LLM_BASE_URL). Skipping AI review.');
    if (token && repo && prNumber) {
      const noKeyNotice = `## 🛡️ ReviewGround AI Code Review

> [!IMPORTANT]
> **No AI Provider API Key Configured**
>
> ReviewGround was unable to run an AI code review on this pull request because no LLM API key was detected in your repository secrets or environment variables.
>
> ### 🔑 How to Activate AI Reviews (1-Minute Setup):
> 1. In this repository, navigate to **Settings ➔ Secrets and variables ➔ Actions**.
> 2. Click **New repository secret** and add your preferred provider key:
>    - **\`GEMINI_API_KEY\`** — Free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey) *(Recommended)*
>    - **\`GROQ_API_KEY\`** — Ultra-fast LPU inference at [Groq Console](https://console.groq.com/keys) *(Free tier)*
>    - **\`OPENROUTER_API_KEY\`** — 15+ free models at [OpenRouter](https://openrouter.ai/keys)
>    - **\`OPENAI_API_KEY\`**, **\`ANTHROPIC_API_KEY\`**, or **\`DEEPSEEK_API_KEY\`**
> 3. Once added, re-run this workflow or push a new commit to start receiving automated AI code reviews!
>
> *(Note: If you only intended to post CI verification summaries, configure \`mode: summary\` in your workflow).*

---
*Powered by [ReviewGround](https://github.com/arungupta1526/ReviewGround)*`;

      await postOrUpdatePrComment(noKeyNotice, token, repo, prNumber, commentTag);
    }
    return null;
  }

  // Get diff
  const rawDiff = await getPullRequestDiff(repo, prNumber, token, config.baseBranch || 'main');
  if (!rawDiff || rawDiff.trim().length === 0) {
    console.log('ℹ️  No code changes found in diff. Skipping review.');
    return null;
  }

  // Apply ignore patterns
  const diff = applyIgnorePatterns(rawDiff, config.ignorePatterns);
  if (!diff) {
    console.log('ℹ️  All changed files were excluded by ignore-patterns. Skipping review.');
    return null;
  }

  // Registry Grounding
  let packageGroundTruthNote = '';
  if (config.enableNpmVerify !== false || config.enableMultiRegistryVerify !== false) {
    const registryResult = await verifyPackagesMultiRegistry(diff);
    if (registryResult.totalVerified > 0) {
      const ecoLabel = registryResult.ecosystems.length > 0 ? registryResult.ecosystems.join(', ').toUpperCase() : 'Registry';
      packageGroundTruthNote = `\nVerified Real-Time ${ecoLabel} Registry Releases:\n${registryResult.notes.map((n) => `- ${n}`).join('\n')}\n(IMPORTANT: Do NOT claim that these verified packages or versions are invalid or non-existent!)\n`;
    }
  }

  // Diff Prioritization & Truncation
  let truncatedDiff: string;
  if (config.enableSmartDiffPriority !== false && diff.length > 28000) {
    const priorityResult = packPrioritizedDiff(diff, 28000);
    truncatedDiff = priorityResult.packedDiff;
    console.log(priorityResult.priorityLog);
    if (priorityResult.skippedFiles.length > 0) {
      console.log(`🗂️ Skipped files (low priority or budget): ${priorityResult.skippedFiles.slice(0, 10).join(', ')}${priorityResult.skippedFiles.length > 10 ? '...' : ''}`);
    }
  } else {
    truncatedDiff = truncateDiffClean(diff);
    if (diff.length > 32000) {
      console.log(`⚠️ Large diff detected (${diff.length} chars) — truncated to ${truncatedDiff.length} chars at clean hunk boundary.`);
    }
  }
  console.log(`🤖 Analyzing code diff (${truncatedDiff.length} characters)...`);

  // Build provider-tailored prompt
  const prompt = buildReviewPrompt({
    reviewLevel: config.reviewLevel,
    reviewLanguage: config.reviewLanguage,
    enableOwaspTagging: config.enableOwaspTagging,
    provider: config.provider,
    model: config.model,
    packageGroundTruthNote,
    truncatedDiff,
  });

  const reviewOptions: ReviewOptions = {
    model: config.model,
    fallbackModels: config.fallbackModels,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    enableSearchGrounding: config.enableSearchGrounding !== false,
  };

  const response = await providerManager.executeReview(prompt, reviewOptions);
  if (!response) {
    console.warn('⚠️ Review execution returned no result.');
    if (token && repo && prNumber) {
      const runId = config.runId || process.env.GITHUB_RUN_ID;
      const runUrl = runId && repo ? `https://github.com/${repo}/actions/runs/${runId}` : '';
      const runLink = runUrl ? `[View GitHub Actions Run Logs](${runUrl})` : 'check the GitHub Actions workflow logs';

      const errorNotice = `## 🛡️ ReviewGround AI Code Review Notice

> [!WARNING]
> **AI Review Generation Failed**
>
> ReviewGround attempted to analyze this pull request, but all configured AI providers failed to return a valid response (e.g. API rate limit, quota exhaustion, network timeout, or invalid credentials).
>
> - **Attempted Provider(s):** ${configuredProviders.map((p) => p.name).join(', ')}
> - Please ${runLink} for detailed error output.
> - Verify your API key quotas or consider configuring a fallback provider (e.g. \`GROQ_API_KEY\`, \`OPENROUTER_API_KEY\`, or \`GEMINI_API_KEY\`).

---
*Powered by [ReviewGround](https://github.com/arungupta1526/ReviewGround)*`;

      await postOrUpdatePrComment(errorNotice, token, repo, prNumber, commentTag);
    }
    return null;
  }

  // Extract inline suggestions JSON block
  let cleanReviewText = response.text;
  const inlineSuggestions: InlineSuggestion[] = [];
  const suggestionBlockRegex = /```inline_suggestions\s*([\s\S]*?)\s*```/;
  const match = response.text.match(suggestionBlockRegex);

  if (match) {
    cleanReviewText = response.text.replace(suggestionBlockRegex, '').trim();
    try {
      const parsed = JSON.parse(match[1]);
      const result = InlineSuggestionsListSchema.safeParse(parsed);
      if (result.success) {
        inlineSuggestions.push(...result.data);
        if (result.data.length > 5) {
          console.log(`ℹ️ ${result.data.length} inline suggestions generated — posting top 5 (GitHub PR review API limit per run).`);
        }
      } else {
        console.warn('ℹ️ Inline suggestions JSON schema validation failed:', result.error.format());
      }
    } catch {
      console.warn('ℹ️ Could not parse inline_suggestions JSON block from AI output.');
    }
  }

  // Test coverage detection
  let testCoverageSection = '';
  if (config.enableTestCoverageCheck !== false) {
    const coverageReport = analyzeTestCoverage(diff);
    if (coverageReport.warnings.length > 0) {
      testCoverageSection = `\n\n### 🧪 Test Coverage\n\n${coverageReport.warnings.join('\n')}\n${coverageReport.suggestedTests}`;
      console.log(`⚠️ [TestCheck] ${coverageReport.warnings[0]}`);
    }
  }

  const groundingBadge = response.searchGroundingUsed ? ' 🌐 *Live Search Grounded*' : '';
  const engineString = `${response.provider} (${response.model})${groundingBadge}`;

  // Cost footer & cumulative multi-run cost tracking
  let previousHistory: CostHistoryEntry[] = [];
  if (config.enableCostFooter !== false && token && repo && prNumber) {
    try {
      const existingComment = await fetchPrReviewComment(repo, token, prNumber, commentTag);
      if (existingComment) {
        previousHistory = parseCostHistory(existingComment);
      }
    } catch {
      // Non-blocking: gracefully fallback to fresh history if unable to fetch previous PR comment
    }
  }

  const costFooter = config.enableCostFooter !== false
    ? generateCostFooter({
        provider: response.provider,
        model: response.model,
        diffLength: truncatedDiff.length,
        responseLength: response.text.length,
        latencyMs: response.latencyMs,
        commitSha: process.env.GITHUB_SHA,
        runId: config.runId || process.env.GITHUB_RUN_ID,
        previousHistory,
      })
    : '';

  const markdownOutput = `## 🛡️ ReviewGround AI Code Review & Security Analysis
*Reviewer Engine: ${engineString}*

${cleanReviewText}${testCoverageSection}\n\n---\n*Generated automatically by [ReviewGround](https://github.com/arungupta1526/ReviewGround) (${engineString}).*${costFooter}
`;

  // Output to console & step summary
  console.log('\n================== 🤖 AI CODE REVIEW ==================\n');
  console.log(markdownOutput);
  console.log('=======================================================\n');

  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile && fs.existsSync(stepSummaryFile)) {
    await fs.promises.appendFile(stepSummaryFile, markdownOutput);
    console.log('✅ Review appended to GitHub Actions step summary.');
  }

  // Post / Update Sticky PR Comment & Suggestions
  await postOrUpdatePrComment(markdownOutput, token, repo, prNumber, commentTag);

  if (config.enablePruneInlineSuggestions && token && repo && prNumber) {
    await prunePreviousInlineComments(repo, token, prNumber);
  }

  if (config.enableInlineSuggestions !== false && token && repo && prNumber) {
    await postInlineSuggestions(inlineSuggestions, token, repo, prNumber);
  }

  if ((config.generatePrDescription || config.enablePrDescriptionUpdate) && token && repo && prNumber) {
    await runPrDescribe({
      githubToken: token,
      repo,
      prNumber,
      baseBranch: config.baseBranch,
      provider: config.provider,
      model: config.model,
      fallbackModels: config.fallbackModels,
      geminiApiKey: config.geminiApiKey,
      openaiApiKey: config.openaiApiKey,
      anthropicApiKey: config.anthropicApiKey,
      groqApiKey: config.groqApiKey,
      deepseekApiKey: config.deepseekApiKey,
      openrouterApiKey: config.openrouterApiKey,
      llmBaseUrl: config.llmBaseUrl,
      llmApiKey: config.llmApiKey,
      enableSearchGrounding: config.enableSearchGrounding,
    });
  }

  if (config.enableCheckRun && token && repo && prNumber) {
    await createCheckRun(cleanReviewText, token, repo, prNumber);
  }

  return response;
}
