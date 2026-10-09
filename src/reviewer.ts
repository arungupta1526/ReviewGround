/**
 * ReviewGround - Universal AI Code Reviewer & Security Advisor
 * Analyzes Git diffs using Multi-Provider BYOK (Gemini, OpenAI, Anthropic, Groq, DeepSeek, Custom)
 * with live NPM registry search grounding, 1-click inline commit suggestions, and sticky comments.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { z } from 'zod';
import { ProviderManager, ProviderResponse, ReviewOptions } from './providers/index.js';

export const InlineSuggestionSchema = z.object({
  path: z.string().min(1),
  line: z.coerce.number().int().positive(),
  suggestion: z.string().min(1),
});

export const InlineSuggestionsListSchema = z.array(InlineSuggestionSchema);

export type InlineSuggestion = z.infer<typeof InlineSuggestionSchema>;

export interface ReviewerConfig {
  githubToken?: string;
  repo?: string;
  prNumber?: string;
  baseBranch?: string;
  provider?: string;
  model?: string;
  fallbackModels?: string[];
  temperature?: number;
  maxTokens?: number;
  enableSearchGrounding?: boolean;
  enableInlineSuggestions?: boolean;
  enableNpmVerify?: boolean;
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

export const DEFAULT_COMMENT_TAG = '<!-- reviewground-code-review -->';
export const CI_SECTION_HEADER = '### 🚦 CI Pipeline Results & Verification';

/**
 * Proactively verifies added/changed npm packages in diff against live npm registry
 * to eliminate LLM version hallucinations (e.g. Node 24, Zod 4, TypeScript 7).
 */
export async function verifyPackagesInDiff(diffText: string): Promise<string[]> {
  const verified: string[] = [];
  const lines = diffText.split('\n');
  const addedDeps: Array<{ name: string; version: string }> = [];

  for (const line of lines) {
    if (!line.startsWith('+')) continue;
    const match = line.match(/^\+\s*"(@?[a-z0-9_./-]+)"\s*:\s*"[\^~>=<]*([0-9]+(?:\.[0-9]+)*[^"]*)"/);
    if (match) {
      const name = match[1];
      const version = match[2];
      const ignore = [
        'name',
        'version',
        'description',
        'scripts',
        'bin',
        'main',
        'types',
        'engines',
        'node',
        'npm',
      ];
      if (!ignore.includes(name)) {
        addedDeps.push({ name, version });
      }
    }
  }

  if (addedDeps.length === 0) return verified;

  await Promise.all(
    addedDeps.map(async (dep) => {
      try {
        const res = await fetch(
          `https://registry.npmjs.org/${encodeURIComponent(dep.name)}/${encodeURIComponent(dep.version)}`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (res.ok) {
          verified.push(`${dep.name}@${dep.version}`);
          return;
        }
        const latestRes = await fetch(
          `https://registry.npmjs.org/${encodeURIComponent(dep.name)}/latest`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (latestRes.ok) {
          const info = (await latestRes.json()) as { version?: string };
          if (info.version) {
            verified.push(`${dep.name} (latest on registry: ${info.version})`);
          }
        }
      } catch {
        // Ignore timeout or network failure
      }
    })
  );

  return verified;
}

/**
 * Retrieves git diff via git CLI, or falls back to GitHub Pull Request API
 * if shallow clone or detached head prevents local diff calculation.
 */
export async function getPullRequestDiff(
  repo?: string,
  prNumber?: string,
  token?: string,
  baseBranch = 'main'
): Promise<string | null> {
  // 1. Try local git diff with base branch
  try {
    const diff = execSync(
      `git diff origin/${baseBranch}...HEAD -- . ":(exclude)package-lock.json" ":(exclude)pnpm-lock.yaml" ":(exclude)yarn.lock"`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
    );
    if (diff && diff.trim().length > 0) return diff;
  } catch {
    // Continue to next fallback
  }

  // 2. Try git diff HEAD~1
  try {
    const diff = execSync(
      'git diff HEAD~1...HEAD -- . ":(exclude)package-lock.json" ":(exclude)pnpm-lock.yaml" ":(exclude)yarn.lock"',
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 }
    );
    if (diff && diff.trim().length > 0) return diff;
  } catch {
    // Continue to GitHub API fallback
  }

  // 3. Fallback to GitHub Pull Request diff API (handles fetch-depth: 1)
  if (repo && prNumber && token) {
    try {
      console.log(`🌐 Fetching PR diff directly from GitHub API (/repos/${repo}/pulls/${prNumber})...`);
      const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3.diff',
          'User-Agent': 'ReviewGround-CI-Reviewer',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const diffText = await res.text();
        if (diffText && diffText.trim().length > 0) {
          return diffText;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Failed to fetch PR diff from GitHub API: ${msg}`);
    }
  }

  return null;
}

/**
 * Posts native GitHub 1-click commit suggestions on PR code diff.
 */
export async function postInlineSuggestions(
  suggestions: InlineSuggestion[],
  token: string,
  repo: string,
  prNumber: string
): Promise<void> {
  if (suggestions.length === 0) return;

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Reviewer',
  };

  try {
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    if (!prRes.ok) {
      console.warn(`⚠️ Could not fetch PR details for inline suggestions: HTTP ${prRes.status}`);
      return;
    }
    const prData = (await prRes.json()) as { head?: { sha?: string } };
    const commitId = prData.head?.sha;
    if (!commitId) {
      console.warn('⚠️ No HEAD commit SHA found on PR. Skipping inline suggestions.');
      return;
    }

    console.log(`🚀 Posting up to 5 inline 1-click commit suggestion(s) to PR #${prNumber}...`);

    for (const item of suggestions.slice(0, 5)) {
      if (!item.path || !item.line || !item.suggestion) continue;

      const body = `### 🤖 ReviewGround 1-Click Code Suggestion\n\`\`\`suggestion\n${item.suggestion.trimEnd()}\n\`\`\``;

      const postRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/comments`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          commit_id: commitId,
          path: item.path,
          line: item.line,
          side: 'RIGHT',
        }),
      });

      if (postRes.ok) {
        console.log(`✅ Posted 1-click commit suggestion on ${item.path}:${item.line}`);
      } else {
        const err = await postRes.text();
        console.warn(`ℹ️ Could not post inline suggestion on ${item.path}:${item.line} (HTTP ${postRes.status}): ${err.slice(0, 150)}`);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Error posting inline suggestions: ${msg}`);
  }
}

/**
 * Creates or updates the sticky PR comment in-place.
 */
export async function postOrUpdatePrComment(
  markdown: string,
  token?: string,
  repo?: string,
  prNumber?: string,
  commentTag = DEFAULT_COMMENT_TAG
): Promise<void> {
  if (!token || !prNumber || !repo) {
    console.log('ℹ️  Skipping PR comment: GITHUB_TOKEN, PR_NUMBER, or REPO_FULL_NAME not provided.');
    return;
  }

  const defaultCommentBody = `${markdown}\n\n${commentTag}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Reviewer',
  };

  try {
    const listRes = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`,
      { headers }
    );

    if (listRes.ok) {
      const comments = (await listRes.json()) as Array<{ id: number; body?: string }>;
      const existing = comments.find((c) => c.body?.includes(commentTag));

      if (existing && existing.body) {
        let commentBody = defaultCommentBody;

        // Preserve existing CI pipeline status block if present
        if (existing.body.includes(CI_SECTION_HEADER)) {
          const ciIndex = existing.body.indexOf(CI_SECTION_HEADER);
          const ciPart = existing.body.slice(ciIndex);
          const tagIndex = ciPart.indexOf(commentTag);
          const preservedCi = tagIndex !== -1 ? ciPart.slice(0, tagIndex).trimEnd() : ciPart.trimEnd();
          commentBody = `${markdown}\n\n---\n\n${preservedCi}\n\n${commentTag}`;
        }

        const updateRes = await fetch(
          `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`,
          {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: commentBody }),
          }
        );

        if (updateRes.ok) {
          console.log(`✅ Updated existing sticky review comment on PR #${prNumber}.`);
          return;
        }
      }
    }

    // No existing comment found, create new one
    const postRes = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: defaultCommentBody }),
      }
    );

    if (postRes.ok) {
      console.log(`✅ Posted review comment directly on PR #${prNumber}.`);
    } else {
      console.warn(`⚠️ Failed to post PR comment: HTTP ${postRes.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Could not post PR comment: ${msg}`);
  }
}

/**
 * Main review execution function.
 */
export async function runReview(config: ReviewerConfig = {}): Promise<ProviderResponse | null> {
  const token = (config.githubToken || process.env.GITHUB_TOKEN || '').trim();
  const repo = (config.repo || process.env.REPO_FULL_NAME || process.env.GITHUB_REPOSITORY || '').trim();
  const prNumber = (config.prNumber || process.env.PR_NUMBER || '').trim();
  const commentTag = config.commentTag || DEFAULT_COMMENT_TAG;

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
    const isBot = process.env.GITHUB_ACTOR?.includes('dependabot') || process.env.GITHUB_ACTOR?.includes('bot');
    if (isBot) {
      console.log('ℹ️  Automated AI review skipped for bot PR: GitHub Actions restricts repo secrets for automated bots.');
    } else {
      console.log('ℹ️  No AI provider API keys configured (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENROUTER_API_KEY, LLM_BASE_URL). Skipping AI review.');
    }
    return null;
  }

  // Get diff
  const diff = await getPullRequestDiff(repo, prNumber, token, config.baseBranch || 'main');
  if (!diff || diff.trim().length === 0) {
    console.log('ℹ️  No code changes found in diff. Skipping review.');
    return null;
  }

  // Verify packages in diff if npm check is enabled
  let packageGroundTruthNote = '';
  if (config.enableNpmVerify !== false) {
    const verifiedPackages = await verifyPackagesInDiff(diff);
    if (verifiedPackages.length > 0) {
      packageGroundTruthNote = `\nVerified Real-Time NPM Registry Releases:\n${verifiedPackages.map((p) => `- ${p} is confirmed published on npm`).join('\n')}\n(IMPORTANT: Do NOT claim that these verified packages or versions are invalid or non-existent!)\n`;
    }
  }

  // Truncate massive diffs to avoid context overflow
  const truncatedDiff = diff.slice(0, 32000);
  console.log(`🤖 Analyzing code diff (${truncatedDiff.length} characters)...`);

  const prompt = `You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.
Analyze the following git diff for:
1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.
2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).
3. Performance bottlenecks (unbounded loops, N+1 queries, unindexed searches, missing cleanup).
4. Direct, actionable code fixes with concise diff blocks.
${packageGroundTruthNote}
If the code looks solid and has no bugs, respond with "✅ All changes look clean, performant, and secure!" and a brief 2-bullet summary.

If you propose specific line-level code replacements on files in the diff, provide your human-readable review first. Then, at the very end of your response, provide an optional JSON block tagged with \`\`\`inline_suggestions so GitHub can render interactive 1-click commit suggestion buttons:
\`\`\`inline_suggestions
[
  {
    "path": "path/to/file.ts",
    "line": 42,
    "suggestion": "  exact line replacement"
  }
]
\`\`\`

Git Diff:
\`\`\`diff
${truncatedDiff}
\`\`\`
`;

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
      } else {
        console.warn('ℹ️ Inline suggestions JSON schema validation failed:', result.error.format());
      }
    } catch {
      console.warn('ℹ️ Could not parse inline_suggestions JSON block from AI output.');
    }
  }

  const groundingBadge = response.searchGroundingUsed ? ' 🌐 *Live Search Grounded*' : '';
  const engineString = `${response.provider} (${response.model})${groundingBadge}`;

  const markdownOutput = `## 🤖 AI Code Review & Security Analysis
*Reviewer Engine: ${engineString}*

${cleanReviewText}

---
*Generated automatically by [ReviewGround](https://github.com/reviewground/reviewground) (${engineString}).*
`;

  // 1. Output to CI Console
  console.log('\n================== 🤖 AI CODE REVIEW ==================\n');
  console.log(markdownOutput);
  console.log('=======================================================\n');

  // 2. Append to GitHub Step Summary
  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile && fs.existsSync(stepSummaryFile)) {
    fs.appendFileSync(stepSummaryFile, markdownOutput);
    console.log('✅ Review appended to GitHub Actions step summary.');
  }

  // 3. Post / Update Sticky PR Comment
  await postOrUpdatePrComment(markdownOutput, token, repo, prNumber, commentTag);

  // 4. Post interactive 1-click commit suggestions
  if (config.enableInlineSuggestions !== false && token && repo && prNumber && inlineSuggestions.length > 0) {
    await postInlineSuggestions(inlineSuggestions, token, repo, prNumber);
  }

  return response;
}
