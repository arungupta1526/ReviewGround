import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateRepo, REPO_REGEX } from '../src/github/comments.js';
import { resolveCostPerMillion, generateCostFooter } from '../src/metrics/costEstimator.js';

describe('GitHub API Security & Validation', () => {
  it('accepts valid GitHub repository formats (owner/repo)', () => {
    assert.doesNotThrow(() => validateRepo('arungupta1526/ReviewGround'));
    assert.doesNotThrow(() => validateRepo('facebook/react'));
    assert.doesNotThrow(() => validateRepo('org-name/repo.sub_name-1'));
  });

  it('rejects invalid or SSRF-prone repository formats', () => {
    assert.throws(() => validateRepo(''), /Invalid repository format/);
    assert.throws(() => validateRepo('repo-only'), /Invalid repository format/);
    assert.throws(() => validateRepo('http://malicious.site/repo'), /Invalid repository format/);
    assert.throws(() => validateRepo('../../etc/passwd'), /Invalid repository format/);
    assert.throws(() => validateRepo('owner/repo/extra-path'), /Invalid repository format/);
    assert.throws(() => validateRepo('owner/repo?query=1'), /Invalid repository format/);
  });

  it('verifies REPO_REGEX accurately matches standard owner/repo naming', () => {
    assert.strictEqual(REPO_REGEX.test('owner/repo'), true);
    assert.strictEqual(REPO_REGEX.test('invalid'), false);
    assert.strictEqual(REPO_REGEX.test('/invalid/repo'), false);
  });

  it('verifies BRANCH_REGEX prevents OS command injection characters', async () => {
    const { BRANCH_REGEX } = await import('../src/github/comments.js');
    assert.strictEqual(BRANCH_REGEX.test('main'), true);
    assert.strictEqual(BRANCH_REGEX.test('feature/login-v2'), true);
    assert.strictEqual(BRANCH_REGEX.test('fix_bug-1.0'), true);
    assert.strictEqual(BRANCH_REGEX.test('main; rm -rf /'), false);
    assert.strictEqual(BRANCH_REGEX.test('main && whoami'), false);
    assert.strictEqual(BRANCH_REGEX.test('main`id`'), false);
    assert.strictEqual(BRANCH_REGEX.test('main$(whoami)'), false);
  });

  it('validates PR numbers correctly rejecting non-integers and injection strings', async () => {
    const { validatePrNumber, PR_NUMBER_REGEX } = await import('../src/github/comments.js');
    assert.doesNotThrow(() => validatePrNumber('12'));
    assert.doesNotThrow(() => validatePrNumber('1'));
    assert.doesNotThrow(() => validatePrNumber('9999'));

    assert.throws(() => validatePrNumber('0'), /Invalid PR number/);
    assert.throws(() => validatePrNumber('-5'), /Invalid PR number/);
    assert.throws(() => validatePrNumber('12/comments'), /Invalid PR number/);
    assert.throws(() => validatePrNumber('12; drop table'), /Invalid PR number/);
    assert.throws(() => validatePrNumber(''), /Invalid PR number/);

    assert.strictEqual(PR_NUMBER_REGEX.test('42'), true);
    assert.strictEqual(PR_NUMBER_REGEX.test('0'), false);
    assert.strictEqual(PR_NUMBER_REGEX.test('abc'), false);
  });
});

describe('Token & Cost Transparency Estimator', () => {
  it('resolves model-specific pricing for flagship and budget models', () => {
    assert.strictEqual(resolveCostPerMillion('gemini-3.5-flash-lite', 'gemini'), 0.075);
    assert.strictEqual(resolveCostPerMillion('gemini-1.5-flash', 'gemini'), 0.075);
    assert.strictEqual(resolveCostPerMillion('gpt-4o', 'openai'), 2.50);
    assert.strictEqual(resolveCostPerMillion('claude-3-5-sonnet', 'anthropic'), 3.00);
    assert.strictEqual(resolveCostPerMillion('claude-3-opus', 'anthropic'), 15.00);
    assert.strictEqual(resolveCostPerMillion('deepseek-chat', 'deepseek'), 0.14);
  });

  it('falls back to provider default pricing when model is unknown', () => {
    assert.strictEqual(resolveCostPerMillion('custom-unlisted-model', 'gemini'), 0.10);
    assert.strictEqual(resolveCostPerMillion('custom-unlisted-model', 'openai'), 0.15);
    assert.strictEqual(resolveCostPerMillion('custom-unlisted-model', 'groq'), 0.06);
  });

  it('accurately computes token counts, latency, and cost footer matching PR review numbers', () => {
    // 8,258 tokens total (e.g. 25000 diff chars -> 6250 tokens; 8032 resp chars -> 2008 tokens = 8258 tokens)
    const footer = generateCostFooter({
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      diffLength: 25000,
      responseLength: 8032,
      latencyMs: 3400,
    });

    assert.ok(footer.includes('`gemini-3.5-flash-lite`'));
    assert.ok(footer.includes('Est. Tokens: 8,258'));
    assert.ok(footer.includes('~$0.0006'));
    assert.ok(footer.includes('3.4s'));
    assert.ok(footer.includes('Saved ~$20–50/mo'));
  });
});

describe('PR Review Thread Outdated Folding Automation', () => {
  it('rejects invalid repo formats before attempting GraphQL calls', async () => {
    const { resolvePreviousInlineSuggestions } = await import('../src/github/reviewThreads.js');
    await assert.rejects(
      async () => resolvePreviousInlineSuggestions('invalid-repo', 'fake-token', '12'),
      /Invalid repository format/
    );
  });

  it('gracefully exits without throwing for malformed PR numbers', async () => {
    const { resolvePreviousInlineSuggestions } = await import('../src/github/reviewThreads.js');
    await assert.doesNotReject(
      async () => resolvePreviousInlineSuggestions('owner/repo', 'fake-token', 'not-a-number')
    );
  });

  it('validates repo and prNumber in prunePreviousInlineComments before executing REST calls', async () => {
    const { prunePreviousInlineComments } = await import('../src/github/reviewThreads.js');
    await assert.rejects(
      async () => prunePreviousInlineComments('invalid-repo', 'fake-token', '12'),
      /Invalid repository format/
    );
    await assert.rejects(
      async () => prunePreviousInlineComments('owner/repo', 'fake-token', 'invalid-pr'),
      /Invalid PR number/
    );
  });
});


