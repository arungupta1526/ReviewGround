/**
 * ReviewGround - Tests for Feature 2: Automated PR Description & Walkthrough Generator
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildDescribePrompt,
  mergePrDescriptionBody,
  PR_DESCRIPTION_TAG,
} from '../src/prDescriber.js';

describe('PR Description & Walkthrough Generator (Feature 2)', () => {
  it('buildDescribePrompt generates prompt with walkthrough table and checklist requirements', () => {
    const diff = `diff --git a/src/auth.ts b/src/auth.ts
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,1 +1,2 @@
+export function rotateToken() {}`;

    const prompt = buildDescribePrompt(diff);
    assert.ok(prompt.includes('Summary of Changes'), 'Prompt must require Summary of Changes');
    assert.ok(prompt.includes('Key Changes'), 'Prompt must require Key Changes');
    assert.ok(prompt.includes('| File | Summary of Changes |'), 'Prompt must require Walkthrough Table');
    assert.ok(prompt.includes('Testing Checklist'), 'Prompt must require Testing Checklist');
    assert.ok(prompt.includes('Risk Assessment'), 'Prompt must require Risk Assessment');
    assert.ok(prompt.includes('rotateToken'), 'Prompt must include diff contents');
  });

  it('mergePrDescriptionBody sets body directly when original body is empty or whitespace', () => {
    const aiMarkdown = '### 📝 Summary of Changes\nAdded JWT rotation.';
    const result = mergePrDescriptionBody('', aiMarkdown);

    assert.ok(result.includes('Added JWT rotation.'));
    assert.ok(result.includes(PR_DESCRIPTION_TAG));
  });

  it('mergePrDescriptionBody replaces placeholder comments if body only contained comments', () => {
    const commentOnlyBody = '<!-- Please write your PR description here -->';
    const aiMarkdown = '### 📝 Summary of Changes\nImplemented new billing routes.';
    const result = mergePrDescriptionBody(commentOnlyBody, aiMarkdown);

    assert.ok(result.includes('Implemented new billing routes.'));
    assert.ok(!result.includes('Please write your PR description here'));
    assert.ok(result.includes(PR_DESCRIPTION_TAG));
  });

  it('mergePrDescriptionBody preserves author text and appends AI section below', () => {
    const authorBody = 'Fixes #42. Closes security issue with token validation.';
    const aiMarkdown = '### 📝 Summary of Changes\nUpdated token verification.';
    const result = mergePrDescriptionBody(authorBody, aiMarkdown);

    assert.ok(result.startsWith('Fixes #42. Closes security issue with token validation.'));
    assert.ok(result.includes('### 🤖 ReviewGround PR Description & Walkthrough'));
    assert.ok(result.includes('Updated token verification.'));
    assert.ok(result.includes(PR_DESCRIPTION_TAG));
  });

  it('mergePrDescriptionBody replaces previous ReviewGround section without duplicating', () => {
    const authorBody = 'Fixes #42.\n\n---\n\n### 🤖 ReviewGround PR Description & Walkthrough\n\nOld AI summary\n\n<!-- reviewground-pr-description -->';
    const aiMarkdown = '### 📝 Summary of Changes\nBrand new updated AI summary.';
    const result = mergePrDescriptionBody(authorBody, aiMarkdown);

    assert.ok(result.includes('Fixes #42.'));
    assert.ok(result.includes('Brand new updated AI summary.'));
    assert.ok(!result.includes('Old AI summary'));
    // Ensure tag appears only once
    const matches = result.match(/<!-- reviewground-pr-description -->/g);
    assert.strictEqual(matches?.length, 1);
  });
});
