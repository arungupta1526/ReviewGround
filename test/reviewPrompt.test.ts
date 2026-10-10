import { describe, it } from 'node:test';
import assert from 'node:assert';
import { loadCustomGuidelines, buildReviewPrompt } from '../src/prompts/reviewPrompt.js';

describe('Review Prompt Builder & Guidelines Ingestion', () => {
  it('loads guidelines from AGENTS.md when present in repository', () => {
    const guidelines = loadCustomGuidelines();
    assert.ok(guidelines.length > 0);
    // Since AGENTS.md exists in this repo root, it should discover it!
    assert.ok(guidelines.includes('AGENTS.md') || guidelines.includes('.reviewground.yml'));
  });

  it('injects anti-nitpick filter and standardized severity badges into prompts', () => {
    const prompt = buildReviewPrompt({
      reviewLevel: 'standard',
      truncatedDiff: '+const a = 1;',
    });

    assert.ok(prompt.includes('STRICT ANTI-NITPICK FILTER'));
    assert.ok(prompt.includes('[BLOCKER]'));
    assert.ok(prompt.includes('[WARNING]'));
    assert.ok(prompt.includes('[SUGGESTION]'));
  });

  it('respects reviewLevel critical with strict security instructions', () => {
    const prompt = buildReviewPrompt({
      reviewLevel: 'critical',
      truncatedDiff: '+const a = 1;',
    });

    assert.ok(prompt.includes('Focus ONLY on critical and security issues'));
    assert.ok(prompt.includes('STRICT ANTI-NITPICK FILTER'));
  });

  it('injects repo context when provided', () => {
    const prompt = buildReviewPrompt({
      reviewLevel: 'standard',
      repoContext: '\nExisting Project Structure (Relevant Directories):\n- src/utils/: [helpers.ts]\n',
      truncatedDiff: '+const a = 1;',
    });

    assert.ok(prompt.includes('Existing Project Structure'));
    assert.ok(prompt.includes('src/utils/'));
  });
});
