/**
 * ReviewGround - GitHub Pull Request Review Thread Automation
 * Automatically queries GraphQL reviewThreads and resolves/folds outdated
 * ReviewGround 1-click code suggestion threads on subsequent CI runs.
 */

import { validateRepo, validatePrNumber } from './comments.js';

/**
 * Automatically resolves and folds previous ReviewGround inline suggestion threads
 * so that fixed or outdated suggestions do not clutter the PR conversation.
 */
export async function resolvePreviousInlineSuggestions(
  repo: string,
  token: string,
  prNumber: string
): Promise<void> {
  validateRepo(repo);
  const [owner, name] = repo.split('/');
  const prNumInt = parseInt(prNumber, 10);
  if (!owner || !name || isNaN(prNumInt)) return;

  const query = `
    query($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          reviewThreads(first: 50) {
            nodes {
              id
              isResolved
              comments(first: 1) {
                nodes {
                  body
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'ReviewGround-AutoResolver',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { owner, name, pr: prNumInt },
      }),
    });

    if (!res.ok) return;

    const data = (await res.json()) as {
      data?: {
        repository?: {
          pullRequest?: {
            reviewThreads?: {
              nodes?: Array<{
                id: string;
                isResolved: boolean;
                comments?: { nodes?: Array<{ body?: string }> };
              }>;
            };
          };
        };
      };
    };

    const threads = data.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
    const unresolvedThreads = threads.filter(
      (thread) =>
        !thread.isResolved &&
        thread.comments?.nodes?.[0]?.body?.includes('ReviewGround 1-Click Code Suggestion')
    );

    await Promise.all(
      unresolvedThreads.map(async (thread) => {
        try {
          const resolveRes = await fetch('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'ReviewGround-AutoResolver',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: `
                mutation($threadId: ID!) {
                  resolveReviewThread(input: { threadId: $threadId }) {
                    thread { id isResolved }
                  }
                }
              `,
              variables: { threadId: thread.id },
            }),
          });
          if (resolveRes.ok) {
            console.log(`🧹 Automatically resolved/folded outdated ReviewGround review thread (${thread.id}).`);
          }
        } catch (err: unknown) {
          console.warn(`⚠️ Failed to resolve thread ${thread.id}:`, err);
        }
      })
    );
  } catch (err: unknown) {
    console.warn('ℹ️ Could not resolve previous review threads via GraphQL:', err);
  }
}

/**
 * Automatically purges and prunes previous ReviewGround inline suggestions
 * using GitHub REST API. Controlled by `enable-prune-inline-suggestions` (default: false).
 */
export async function prunePreviousInlineComments(
  repo: string,
  token: string,
  prNumber: string
): Promise<number> {
  validateRepo(repo);
  validatePrNumber(prNumber);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-AutoPruner',
  };

  let deletedCount = 0;
  try {
    let page = 1;
    const maxPages = 3;
    const botSuggestions: Array<{ id: number }> = [];

    while (page <= maxPages) {
      const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}/comments?per_page=100&page=${page}`, { headers });
      if (!res.ok) {
        if (page === 1) {
          console.warn(`⚠️ Could not fetch PR review comments for pruning: HTTP ${res.status}`);
        }
        break;
      }

      const comments = (await res.json()) as Array<{
        id: number;
        body?: string;
        user?: { login?: string };
      }>;

      if (!Array.isArray(comments) || comments.length === 0) break;

      const matches = comments.filter(
        (c) =>
          c.body?.includes('ReviewGround 1-Click Code Suggestion') &&
          (c.user?.login?.includes('bot') || c.user?.login === 'github-actions[bot]')
      );
      botSuggestions.push(...matches);

      if (comments.length < 100) break;
      page++;
    }

    if (botSuggestions.length === 0) {
      return 0;
    }

    console.log(`🧹 Found ${botSuggestions.length} previous ReviewGround inline suggestion(s) to prune.`);

    await Promise.all(
      botSuggestions.map(async (c) => {
        try {
          const delRes = await fetch(`https://api.github.com/repos/${repo}/pulls/comments/${c.id}`, {
            method: 'DELETE',
            headers,
          });
          if (delRes.status === 204 || delRes.ok) {
            deletedCount++;
          }
        } catch (err: unknown) {
          console.warn(`⚠️ Failed to prune comment ${c.id}:`, err);
        }
      })
    );

    console.log(`🧹 Successfully pruned ${deletedCount} previous ReviewGround inline suggestion(s).`);
  } catch (err: unknown) {
    console.warn('⚠️ Error during pruning of previous inline comments:', err);
  }

  return deletedCount;
}
