/**
 * ReviewGround - GitHub Pull Request Comment & Diff Operations
 * Handles fetching PR diffs, creating/updating sticky PR comments,
 * posting direct replies, and posting 1-click inline commit suggestions.
 */

import { execSync } from 'child_process';
import { z } from 'zod';

export const DEFAULT_COMMENT_TAG = '<!-- reviewground-code-review -->';
export const CI_SECTION_HEADER = '### 🚦 CI Pipeline Results & Verification';

export const REPO_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * Validates repository format strictly to prevent SSRF and path traversal injection.
 */
export function validateRepo(repo: string): void {
  if (!repo || !REPO_REGEX.test(repo.trim())) {
    throw new Error(`Invalid repository format: "${repo}". Expected format: owner/repo`);
  }
}

export const InlineSuggestionSchema = z.object({
  path: z.string().min(1),
  line: z.coerce.number().int().positive(),
  suggestion: z.string().min(1),
});

export const InlineSuggestionsListSchema = z.array(InlineSuggestionSchema);
export type InlineSuggestion = z.infer<typeof InlineSuggestionSchema>;

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
  // 1. Try local git diff with base branch (5MB safe buffer guard)
  try {
    const diff = execSync(
      `git diff origin/${baseBranch}...HEAD -- . ":(exclude)package-lock.json" ":(exclude)pnpm-lock.yaml" ":(exclude)yarn.lock"`,
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5 }
    );
    if (diff && diff.trim().length > 0) return diff;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`ℹ️ Local base branch git diff failed or exceeded buffer limit: ${msg}`);
  }

  // 2. Try git diff HEAD~1 (5MB safe buffer guard)
  try {
    const diff = execSync(
      'git diff HEAD~1...HEAD -- . ":(exclude)package-lock.json" ":(exclude)pnpm-lock.yaml" ":(exclude)yarn.lock"',
      { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5 }
    );
    if (diff && diff.trim().length > 0) return diff;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`ℹ️ Local HEAD~1 git diff failed or exceeded buffer limit: ${msg}`);
  }

  // 3. Fallback to GitHub Pull Request diff API (handles fetch-depth: 1)
  if (repo && prNumber && token) {
    try {
      validateRepo(repo);
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
 * Searches PR comments for an existing ReviewGround sticky review comment.
 */
export async function fetchPrReviewComment(
  repo: string,
  token: string,
  prNumber: string,
  commentTag: string
): Promise<string | null> {
  validateRepo(repo);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-SlashCommand',
  };

  let page = 1;
  const MAX_PAGES = 10;
  while (page <= MAX_PAGES) {
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

/**
 * Posts a standalone comment directly to the PR discussion.
 */
export async function postDirectComment(
  body: string,
  repo: string,
  token: string,
  prNumber: string
): Promise<void> {
  validateRepo(repo);
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

import { resolvePreviousInlineSuggestions } from './reviewThreads.js';
export { resolvePreviousInlineSuggestions };

/**
 * Posts native GitHub 1-click commit suggestions on PR code diff,
 * after automatically resolving any outdated ReviewGround suggestion threads.
 */
export async function postInlineSuggestions(
  suggestions: InlineSuggestion[],
  token: string,
  repo: string,
  prNumber: string
): Promise<void> {
  validateRepo(repo);

  // Automatically fold/resolve previous ReviewGround suggestions in GitHub UI
  await resolvePreviousInlineSuggestions(repo, token, prNumber);

  if (suggestions.length === 0) {
    console.log('✅ No new inline suggestions needed — previous suggestion threads resolved/folded.');
    return;
  }

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

      // CWE-284 path traversal security check
      if (item.path.includes('..') || item.path.startsWith('/') || item.path.startsWith('\\')) {
        console.warn(`⚠️ Skipping inline suggestion with suspicious path traversal: ${item.path}`);
        continue;
      }

      const sanitizedSuggestion = item.suggestion.replace(/```/g, '\\`\\`\\`');
      const body = `### 🤖 ReviewGround 1-Click Code Suggestion\n\`\`\`suggestion\n${sanitizedSuggestion.trimEnd()}\n\`\`\``;

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
  validateRepo(repo);

  const defaultCommentBody = `${markdown}\n\n${commentTag}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Reviewer',
  };

  try {
    let existing: { id: number; body?: string } | undefined;
    let page = 1;
    const MAX_PAGES = 10;
    while (!existing && page <= MAX_PAGES) {
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
