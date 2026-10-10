/**
 * ReviewGround - GitHub Pull Request Review Thread Automation
 * Automatically queries GraphQL reviewThreads and resolves/folds outdated
 * ReviewGround 1-click code suggestion threads on subsequent CI runs.
 */

import { validateRepo } from './comments.js';

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
