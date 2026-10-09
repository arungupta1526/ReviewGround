import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatDuration,
  getStatusBadge,
  buildCiSummaryMarkdown,
  buildDynamicCiSummaryMarkdown,
  hasCiData,
} from '../src/summary.js';

describe('CI Summary & Duration Tracking', () => {
  it('formats milliseconds into human-readable duration strings', () => {
    assert.strictEqual(formatDuration(0), '—');
    assert.strictEqual(formatDuration(-100), '—');
    assert.strictEqual(formatDuration(9400), '9s');
    assert.strictEqual(formatDuration(24100), '24s');
    assert.strictEqual(formatDuration(60000), '1m');
    assert.strictEqual(formatDuration(90000), '1m 30s');
    assert.strictEqual(formatDuration(125000), '2m 5s');
  });

  it('maps CI status results to icons and badges', () => {
    assert.deepStrictEqual(getStatusBadge('success'), { icon: '✅', text: 'Passed' });
    assert.deepStrictEqual(getStatusBadge('failure'), { icon: '❌', text: 'Failed' });
    assert.deepStrictEqual(getStatusBadge('cancelled'), { icon: '⚠️', text: 'Cancelled' });
    assert.deepStrictEqual(getStatusBadge('skipped'), { icon: '⚪', text: 'Skipped' });
    assert.deepStrictEqual(getStatusBadge(''), { icon: '❓', text: 'Unknown' });
  });

  it('builds passing CI summary markdown table with run link', () => {
    const md = buildCiSummaryMarkdown(
      'success',
      'success',
      'success',
      'success',
      { gitleaks: '9s', audit: '12s', build: '35s', test: '18s' },
      '123456',
      'owner/repo'
    );

    assert.ok(md.includes('### 🚦 CI Pipeline Results & Verification'));
    assert.ok(md.includes('| 🐍 **1. Gitleaks Secret Scan** | ✅ Passed | `9s` |'));
    assert.ok(md.includes('| 🐍 **2. Dependency Audit** | ✅ Passed | `12s` |'));
    assert.ok(md.includes('| 🐍 **3. Build & Compilation** | ✅ Passed | `35s` |'));
    assert.ok(md.includes('| 🐍 **4. Test Verification** | ✅ Passed | `18s` |'));
    assert.ok(md.includes('🎉 **All CI checks passed successfully!'));
    assert.ok(md.includes('https://github.com/owner/repo/actions/runs/123456'));
  });

  it('builds failing CI summary markdown with specific failure names', () => {
    const md = buildCiSummaryMarkdown(
      'success',
      'failure',
      'cancelled',
      'skipped',
      { gitleaks: '8s' }
    );

    assert.ok(md.includes('❌ **CI Pipeline failed at: Dependency Audit.**'));
  });

  it('correctly determines whether CI data exists via hasCiData', () => {
    // Empty / unknown / missing inputs should return false
    assert.strictEqual(hasCiData('', '', '', '', '', {}), false);
    assert.strictEqual(hasCiData('unknown', 'unknown', 'unknown', 'unknown', '', {}), false);
    assert.strictEqual(hasCiData(undefined, undefined, undefined, undefined, undefined, {}), false);

    // Any valid stage input should return true
    assert.strictEqual(hasCiData('success', 'unknown', 'unknown', 'unknown', '', {}), true);
    assert.strictEqual(hasCiData('unknown', 'failure', 'unknown', 'unknown', '', {}), true);
    assert.strictEqual(hasCiData('unknown', 'unknown', 'success', 'unknown', '', {}), true);
    assert.strictEqual(hasCiData('unknown', 'unknown', 'unknown', 'cancelled', '', {}), true);

    // Extra stages should return true
    assert.strictEqual(hasCiData('', '', '', '', '[{"name":"Deploy","result":"success"}]', {}), true);

    // Detected job durations should return true even if inputs are missing
    assert.strictEqual(hasCiData('', '', '', '', '', { build: '10s' }), true);

    // Discovered jobs should return true even if all inputs are missing
    assert.strictEqual(hasCiData('', '', '', '', '', {}, 3), true);
    assert.strictEqual(hasCiData('', '', '', '', '', {}, 0), false);
  });

  it('builds dynamic CI summary markdown table for arbitrary workflow jobs', () => {
    const jobs = [
      { id: 1, name: 'Lint & Typecheck', status: 'completed', conclusion: 'success', duration: '14s', url: 'https://github.com/runs/1/job/1' },
      { id: 2, name: 'Docker Build', status: 'completed', conclusion: 'success', duration: '1m 20s', url: 'https://github.com/runs/1/job/2' },
      { id: 3, name: 'Playwright E2E', status: 'completed', conclusion: 'failure', duration: '45s', url: 'https://github.com/runs/1/job/3' },
    ];

    const md = buildDynamicCiSummaryMarkdown(jobs, '123456', 'owner/repo');
    assert.ok(md.includes('### 🚦 CI Pipeline Results & Verification'));
    assert.ok(md.includes('| 🧪 **1. Lint & Typecheck** | ✅ Passed | `14s` | [View Logs](https://github.com/runs/1/job/1) |'));
    assert.ok(md.includes('| 🧪 **2. Docker Build** | ✅ Passed | `1m 20s` | [View Logs](https://github.com/runs/1/job/2) |'));
    assert.ok(md.includes('| 🧪 **3. Playwright E2E** | ❌ Failed | `45s` | [View Logs](https://github.com/runs/1/job/3) |'));
    assert.ok(md.includes('❌ **CI Pipeline failed at: Playwright E2E.**'));
  });
});
