/**
 * ReviewGround - Universal AI Code Reviewer & Security Advisor
 * Analyzes Git diffs using Multi-Provider BYOK (Gemini, OpenAI, Anthropic, Groq, DeepSeek, Custom)
 * with live NPM registry search grounding, 1-click inline commit suggestions, and sticky comments.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { z } from 'zod';
import { ProviderManager, ProviderResponse, ReviewOptions } from './providers/index.js';

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
  enableNpmVerify?: boolean;
  enablePrDescriptionUpdate?: boolean;
  enableCheckRun?: boolean;
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
    // Paginate through all comment pages to find the sticky comment (handles PRs with >100 comments)
    let existing: { id: number; body?: string } | undefined;
    let page = 1;
    while (!existing) {
      const listRes = await fetch(
        `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100&page=${page}`,
        { headers }
      );
      if (!listRes.ok) break;
      const comments = (await listRes.json()) as Array<{ id: number; body?: string }>;
      if (comments.length === 0) break;
      existing = comments.find((c) => c.body?.includes(commentTag));
      if (existing || comments.length < 100) break;
      page++;
    }

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

  // Apply ignore patterns — strip matching file hunks from diff
  let diff = rawDiff;
  if (config.ignorePatterns && config.ignorePatterns.length > 0) {
    const patterns = config.ignorePatterns.map((p) => p.trim()).filter(Boolean);
    const hunkBlocks = diff.split(/(?=^diff --git)/m);
    const filtered = hunkBlocks.filter((block) => {
      const fileHeader = block.match(/^diff --git a\/(.+?) b\//m);
      if (!fileHeader) return true;
      const filePath = fileHeader[1];
      return !patterns.some((pattern) => {
        // Simple glob: support **, *, and literal prefix matching
        const regex = new RegExp(
          '^' + pattern.replace(/\*\*/g, '.+').replace(/\*/g, '[^/]+').replace(/\./g, '\\.') + '$'
        );
        return regex.test(filePath);
      });
    });
    diff = filtered.join('');
    if (hunkBlocks.length !== filtered.length) {
      console.log(`🛡️ Ignored ${hunkBlocks.length - filtered.length} file(s) matching ignore-patterns: [${patterns.join(', ')}]`);
    }
    if (!diff || diff.trim().length === 0) {
      console.log('ℹ️  All changed files were excluded by ignore-patterns. Skipping review.');
      return null;
    }
  }

  // Verify packages in diff if npm check is enabled
  let packageGroundTruthNote = '';
  if (config.enableNpmVerify !== false) {
    const verifiedPackages = await verifyPackagesInDiff(diff);
    if (verifiedPackages.length > 0) {
      packageGroundTruthNote = `\nVerified Real-Time NPM Registry Releases:\n${verifiedPackages.map((p) => `- ${p} is confirmed published on npm`).join('\n')}\n(IMPORTANT: Do NOT claim that these verified packages or versions are invalid or non-existent!)\n`;
    }
  }

  // Truncate massive diffs at a clean hunk boundary to avoid sending malformed diffs to LLMs
  const truncatedDiff = truncateDiffClean(diff);
  if (diff.length > 32000) {
    console.log(`⚠️ Large diff detected (${diff.length} chars) — truncated to ${truncatedDiff.length} chars at clean hunk boundary.`);
  }
  console.log(`🤖 Analyzing code diff (${truncatedDiff.length} characters)...`);

  // Build dynamic prompt based on review-level
  const reviewLevel = config.reviewLevel || 'standard';
  const reviewFocusMap: Record<string, string> = {
    critical:
      '1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.\n2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).\n\nFocus ONLY on critical and security issues. Do NOT comment on style, naming, or minor improvements.',
    standard:
      '1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.\n2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).\n3. Performance bottlenecks (unbounded loops, N+1 queries, unindexed searches, missing cleanup).\n4. Direct, actionable code fixes with concise diff blocks.',
    comprehensive:
      '1. Critical bugs, edge-case regressions, unhandled exceptions, and memory/resource leaks.\n2. Security risks (OWASP Top 10, secret leaks, SSRF, injection, XSS, insecure deserialization).\n3. Performance bottlenecks (unbounded loops, N+1 queries, unindexed searches, missing cleanup).\n4. Code style, readability, naming conventions, and documentation gaps.\n5. Test coverage gaps and missing edge-case test scenarios.\n6. Direct, actionable code fixes with concise diff blocks.',
  };
  const focusInstructions = reviewFocusMap[reviewLevel] ?? reviewFocusMap.standard;
  // Check for repository custom review guidelines (.reviewground.yml / .github/reviewground.yml)
  let customGuidelines = '';
  for (const filename of ['.reviewground.yml', '.reviewground.yaml', '.github/reviewground.yml']) {
    if (fs.existsSync(filename)) {
      try {
        const content = fs.readFileSync(filename, 'utf-8').trim();
        if (content) {
          customGuidelines = `\nRepository Custom Rules & Guidelines (${filename}):\n${content}\n`;
          console.log(`📋 Loaded custom review guidelines from ${filename}`);
          break;
        }
      } catch {
        // Continue if unreadable
      }
    }
  }

  // F6: Multi-language output instruction
  const lang = (config.reviewLanguage || 'en').toLowerCase().trim();
  const languageInstruction =
    lang !== 'en' && lang !== 'english'
      ? `\nIMPORTANT: Write your entire review response in the following language: ${lang}.\n`
      : '';

  // Detect active provider for I7: Provider-specific prompt optimization
  const activeProviderName = (config.provider || '').toLowerCase();
  let prompt: string;

  if (activeProviderName === 'anthropic' || (config.model || '').toLowerCase().startsWith('claude')) {
    // I7 — Claude: Prefers XML-structured tags for diff and instructions
    prompt = `<instructions>
You are a Principal Software Engineer &amp; DevSecOps Lead reviewing a Pull Request.
Analyze the following git diff for:
${focusInstructions}
${packageGroundTruthNote}${customGuidelines}${languageInstruction}
If the code looks solid and has no issues at this review level, respond with "✅ All changes look clean, performant, and secure!" and a brief 2-bullet summary.

If you propose specific line-level code replacements, provide your human-readable review first. Then, at the very end of your response, provide an optional JSON block tagged with \`\`\`inline_suggestions:
\`\`\`inline_suggestions
[{ "path": "path/to/file.ts", "line": 42, "suggestion": "  exact line replacement" }]
\`\`\`
</instructions>

<diff>
${truncatedDiff}
</diff>
`;
  } else if (activeProviderName === 'gemini' || (config.model || '').toLowerCase().startsWith('gemini')) {
    // I7 — Gemini: Benefits from explicit schema and JSON-structured output hints
    prompt = `You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.

Task: Analyze the git diff below and produce a structured code review.

Review focus:
${focusInstructions}
${packageGroundTruthNote}${customGuidelines}${languageInstruction}
Response format:
- Start with a brief executive summary (1-2 sentences).
- Use markdown sections (## Bugs, ## Security, ## Performance, etc.) as appropriate for this review level.
- If code looks clean, respond: "✅ All changes look clean, performant, and secure!" plus 2-bullet summary.
- If you have specific line replacements, append a JSON block at the end:

\`\`\`inline_suggestions
[{ "path": "path/to/file.ts", "line": 42, "suggestion": "  exact line replacement" }]
\`\`\`

Git Diff:
\`\`\`diff
${truncatedDiff}
\`\`\`
`;
  } else if (
    activeProviderName === 'groq' ||
    (config.model || '').toLowerCase().startsWith('qwen') ||
    (config.model || '').toLowerCase().startsWith('llama')
  ) {
    // I7 — Groq/Qwen: Performs better with clear markdown-separated sections
    prompt = `## Role
You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.

## Task
Analyze the following git diff.

## Review Focus
${focusInstructions}
${packageGroundTruthNote}${customGuidelines}${languageInstruction}
## Instructions
- If the code is clean, say: "✅ All changes look clean, performant, and secure!" followed by 2 bullet points.
- Otherwise, list findings grouped under ### headers (Bugs, Security, Performance, etc.).
- For specific line fixes, append at the very end:

\`\`\`inline_suggestions
[{ "path": "path/to/file.ts", "line": 42, "suggestion": "  exact line replacement" }]
\`\`\`

## Git Diff
\`\`\`diff
${truncatedDiff}
\`\`\`
`;
  } else {
    // Default generic prompt (OpenAI, DeepSeek, OpenRouter, Custom)
    prompt = `You are a Principal Software Engineer & DevSecOps Lead reviewing a Pull Request.
Analyze the following git diff for:
${focusInstructions}
${packageGroundTruthNote}${customGuidelines}${languageInstruction}
If the code looks solid and has no issues at this review level, respond with "✅ All changes look clean, performant, and secure!" and a brief 2-bullet summary.

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
  }


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

      const errorNotice = `## 🤖 AI Code Review Notice

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

  const groundingBadge = response.searchGroundingUsed ? ' 🌐 *Live Search Grounded*' : '';
  const engineString = `${response.provider} (${response.model})${groundingBadge}`;

  const markdownOutput = `## 🤖 AI Code Review & Security Analysis
*Reviewer Engine: ${engineString}*

${cleanReviewText}

---
*Generated automatically by [ReviewGround](https://github.com/arungupta1526/ReviewGround) (${engineString}).*
`;

  // 1. Output to CI Console
  console.log('\n================== 🤖 AI CODE REVIEW ==================\n');
  console.log(markdownOutput);
  console.log('=======================================================\n');

  // 2. Append to GitHub Step Summary (async to avoid blocking event loop)
  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile && fs.existsSync(stepSummaryFile)) {
    await fs.promises.appendFile(stepSummaryFile, markdownOutput);
    console.log('✅ Review appended to GitHub Actions step summary.');
  }

  // 3. Post / Update Sticky PR Comment
  await postOrUpdatePrComment(markdownOutput, token, repo, prNumber, commentTag);

  // 4. Post interactive 1-click commit suggestions
  if (config.enableInlineSuggestions !== false && token && repo && prNumber && inlineSuggestions.length > 0) {
    await postInlineSuggestions(inlineSuggestions, token, repo, prNumber);
  }

  // 5. F1 — Auto-update PR description with AI summary + risk badge
  if (config.enablePrDescriptionUpdate && token && repo && prNumber) {
    await updatePrDescription(cleanReviewText, token, repo, prNumber);
  }

  // 6. F3 — Create GitHub Check Run (pass/fail gate for branch protection)
  if (config.enableCheckRun && token && repo && prNumber) {
    await createCheckRun(cleanReviewText, token, repo, prNumber);
  }

  return response;
}

/**
 * F1 — Auto-updates the PR body with an AI-generated summary, changed-areas
 * checklist, and a risk level badge. Appends a dedicated section below the
 * original PR description so the author's content is preserved.
 */
export async function updatePrDescription(
  reviewText: string,
  token: string,
  repo: string,
  prNumber: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Reviewer',
    'Content-Type': 'application/json',
  };

  try {
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    if (!prRes.ok) {
      console.warn(`⚠️ [F1] Could not fetch PR for description update: HTTP ${prRes.status}`);
      return;
    }
    const prData = (await prRes.json()) as { body?: string | null };
    const originalBody = prData.body || '';

    // Determine risk level from keywords in review text
    const lowerReview = reviewText.toLowerCase();
    const hasCritical =
      lowerReview.includes('critical') ||
      lowerReview.includes('security') ||
      lowerReview.includes('vulnerability') ||
      lowerReview.includes('injection') ||
      lowerReview.includes('xss');
    const hasMedium =
      lowerReview.includes('performance') ||
      lowerReview.includes('memory') ||
      lowerReview.includes('leak') ||
      lowerReview.includes('warning');
    const riskBadge = hasCritical
      ? '🔴 **Risk Level: HIGH** — Critical issues require attention before merge.'
      : hasMedium
        ? '🟡 **Risk Level: MEDIUM** — Performance or style improvements suggested.'
        : '🟢 **Risk Level: LOW** — Changes look clean and safe to merge.';

    const DESCRIPTION_TAG = '<!-- reviewground-pr-description -->';
    const aiSection = `\n\n---\n\n### 🤖 ReviewGround AI Summary\n\n${riskBadge}\n\n> *Auto-generated by [ReviewGround](https://github.com/arungupta1526/reviewground). Remove this section if not needed.*\n\n${DESCRIPTION_TAG}`;

    let newBody: string;
    if (originalBody.includes(DESCRIPTION_TAG)) {
      // Replace existing AI section to keep it fresh
      newBody = originalBody.replace(
        /\n\n---\n\n### 🤖 ReviewGround AI Summary[\s\S]*?<!-- reviewground-pr-description -->/,
        aiSection
      );
    } else {
      newBody = originalBody + aiSection;
    }

    const updateRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ body: newBody }),
    });

    if (updateRes.ok) {
      console.log(`✅ [F1] Updated PR #${prNumber} description with AI summary and risk badge.`);
    } else {
      console.warn(`⚠️ [F1] Could not update PR description: HTTP ${updateRes.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [F1] Error updating PR description: ${msg}`);
  }
}

/**
 * F3 — Creates a GitHub Check Run that acts as a pass/fail gate.
 * Teams can require this check in branch protection rules.
 * Conclusion is 'failure' when the review finds critical issues; 'success' otherwise.
 */
export async function createCheckRun(
  reviewText: string,
  token: string,
  repo: string,
  prNumber: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Reviewer',
    'Content-Type': 'application/json',
  };

  try {
    // Get the HEAD SHA from the PR
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    if (!prRes.ok) {
      console.warn(`⚠️ [F3] Could not fetch PR SHA for check run: HTTP ${prRes.status}`);
      return;
    }
    const prData = (await prRes.json()) as { head?: { sha?: string } };
    const headSha = prData.head?.sha;
    if (!headSha) {
      console.warn('⚠️ [F3] No HEAD SHA found on PR. Skipping check run creation.');
      return;
    }

    // Determine check conclusion based on review findings
    const lowerReview = reviewText.toLowerCase();
    const hasCriticalIssues =
      lowerReview.includes('critical') ||
      lowerReview.includes('vulnerability') ||
      lowerReview.includes('security risk') ||
      lowerReview.includes('injection') ||
      lowerReview.includes('secret leak');

    const conclusion = hasCriticalIssues ? 'failure' : 'success';
    const title = hasCriticalIssues
      ? 'ReviewGround: Critical issues found — review required'
      : 'ReviewGround: Code review passed';
    const summary = hasCriticalIssues
      ? 'ReviewGround detected critical security or correctness issues in this PR. Please address them before merging.'
      : 'ReviewGround AI review completed. No critical issues were found in this PR.';

    const checkRes = await fetch(`https://api.github.com/repos/${repo}/check-runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'ReviewGround AI Review',
        head_sha: headSha,
        status: 'completed',
        conclusion,
        output: {
          title,
          summary,
          text: reviewText.slice(0, 65535), // GitHub Check Run output limit
        },
      }),
    });

    if (checkRes.ok) {
      console.log(`✅ [F3] GitHub Check Run created (conclusion: ${conclusion}) for PR #${prNumber}.`);
    } else {
      const errText = await checkRes.text();
      console.warn(`⚠️ [F3] Could not create Check Run: HTTP ${checkRes.status} — ${errText.slice(0, 200)}`);
      console.warn('ℹ️  Ensure the workflow has `checks: write` permission for GitHub Check Run gate.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [F3] Error creating Check Run: ${msg}`);
  }
}

