/**
 * ReviewGround - Sticky Comment Updater
 * Updates or creates the single in-place PR comment for CI summaries,
 * preserving existing AI review sections and avoiding noisy duplicate comments.
 */

import { DEFAULT_COMMENT_TAG, CI_SECTION_HEADER, validateRepo, validatePrNumber } from './comments.js';

export async function updateOrCreateStickyComment(
  ciSummaryMarkdown: string,
  token?: string,
  repo?: string,
  prNumber?: string,
  commentTag = DEFAULT_COMMENT_TAG
): Promise<void> {
  if (!token || !prNumber || !repo) {
    console.log('ℹ️  Skipping PR comment update: Missing GITHUB_TOKEN, PR_NUMBER, or REPO_FULL_NAME.');
    return;
  }
  validateRepo(repo);
  validatePrNumber(prNumber);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Summary',
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
      if (!listRes.ok) {
        console.warn(`⚠️ Could not list comments for PR #${prNumber}: HTTP ${listRes.status}`);
        break;
      }
      const comments = (await listRes.json()) as Array<{ id: number; body?: string }>;
      if (comments.length === 0) break;
      existing = comments.find((c) => c.body?.includes(commentTag));
      if (existing || comments.length < 100) break;
      page++;
    }

    if (existing && existing.body) {
      let updatedBody = existing.body;

      if (updatedBody.includes(CI_SECTION_HEADER)) {
        const parts = updatedBody.split(CI_SECTION_HEADER);
        const beforeHeader = parts[0];
        updatedBody = `${beforeHeader.trimEnd()}\n\n${ciSummaryMarkdown}\n\n${commentTag}`;
      } else {
        const tagIndex = updatedBody.indexOf(commentTag);
        if (tagIndex !== -1) {
          const beforeTag = updatedBody.slice(0, tagIndex).trimEnd();
          updatedBody = `${beforeTag}\n\n---\n\n${ciSummaryMarkdown}\n\n${commentTag}`;
        } else {
          updatedBody = `${updatedBody.trimEnd()}\n\n---\n\n${ciSummaryMarkdown}\n\n${commentTag}`;
        }
      }

      const updateRes = await fetch(
        `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: updatedBody }),
        }
      );

      if (updateRes.ok) {
        console.log(`✅ Successfully updated Sticky Comment on PR #${prNumber} with CI summary.`);
        return;
      }
      console.warn(`⚠️ Failed to patch existing comment: HTTP ${updateRes.status}`);
    }

    const newBody = `${ciSummaryMarkdown}\n\n${commentTag}`;
    const postRes = await fetch(
      `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newBody }),
      }
    );

    if (postRes.ok) {
      console.log(`✅ Created new Sticky Comment with CI summary on PR #${prNumber}.`);
    } else {
      console.warn(`⚠️ Failed to create new comment: HTTP ${postRes.status}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ Error updating PR sticky comment: ${msg}`);
  }
}
