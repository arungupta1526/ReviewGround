/**
 * ReviewGround - Post-CI Sticky Summary & Verification Reporter
 * Summarizes Gitleaks, Dependency Audit, Build, and Unit Test results.
 * Tracks stage durations via the GitHub Actions API and updates the existing
 * single PR review comment (Sticky Comment pattern) without duplicate noise.
 */

import * as fs from 'fs';
import {
  DEFAULT_COMMENT_TAG,
  CI_SECTION_HEADER,
  DiscoveredCiJob,
  StageDurations,
  formatDuration,
  fetchWorkflowRunJobs,
  fetchStageDurations,
  updateOrCreateStickyComment,
} from './github/index.js';

// Re-export types and helpers for backward compatibility
export {
  DiscoveredCiJob,
  StageDurations,
  formatDuration,
  fetchWorkflowRunJobs,
  fetchStageDurations,
  updateOrCreateStickyComment,
};

export interface SummaryConfig {
  githubToken?: string;
  repo?: string;
  prNumber?: string;
  runId?: string;
  gitleaksResult?: string;
  auditResult?: string;
  buildResult?: string;
  testResult?: string;
  commentTag?: string;
  extraStages?: string;
  mode?: string;
}

export function getStatusBadge(result?: string): { icon: string; text: string } {
  switch (result?.toLowerCase()) {
    case 'success':
      return { icon: '✅', text: 'Passed' };
    case 'failure':
      return { icon: '❌', text: 'Failed' };
    case 'cancelled':
      return { icon: '⚠️', text: 'Cancelled' };
    case 'skipped':
      return { icon: '⚪', text: 'Skipped' };
    case 'in_progress':
      return { icon: '⏳', text: 'In Progress' };
    case 'queued':
      return { icon: '🕒', text: 'Queued' };
    default:
      return { icon: '❓', text: result || 'Unknown' };
  }
}

/**
 * Determines whether any CI verification stage inputs or workflow jobs exist.
 */
export function hasCiData(
  gitleaks?: string,
  audit?: string,
  build?: string,
  test?: string,
  extraStages?: string,
  durations: StageDurations = {},
  discoveredJobsCount = 0
): boolean {
  const hasInputs = Boolean(
    (gitleaks && gitleaks !== 'unknown' && gitleaks.trim().length > 0) ||
    (audit && audit !== 'unknown' && audit.trim().length > 0) ||
    (build && build !== 'unknown' && build.trim().length > 0) ||
    (test && test !== 'unknown' && test.trim().length > 0) ||
    (extraStages && extraStages.trim().length > 0)
  );
  const hasJobDurations = Object.keys(durations).length > 0;
  return hasInputs || hasJobDurations || discoveredJobsCount > 0;
}

export function buildCiSummaryMarkdown(
  gitleaks: string,
  audit: string,
  build: string,
  test: string,
  durations: StageDurations,
  runId?: string,
  repo?: string,
  extraStagesJson?: string
): string {
  const gBadge = getStatusBadge(gitleaks);
  const aBadge = getStatusBadge(audit);
  const bBadge = getStatusBadge(build);
  const tBadge = getStatusBadge(test);

  const gDur = durations.gitleaks ? `\`${durations.gitleaks}\`` : '—';
  const aDur = durations.audit ? `\`${durations.audit}\`` : '—';
  const bDur = durations.build ? `\`${durations.build}\`` : '—';
  const tDur = durations.test ? `\`${durations.test}\`` : '—';

  const allPassed =
    gitleaks === 'success' &&
    audit === 'success' &&
    build === 'success' &&
    test === 'success';

  const anyFailed =
    gitleaks === 'failure' ||
    audit === 'failure' ||
    build === 'failure' ||
    test === 'failure';

  const runUrl = runId && repo ? `https://github.com/${repo}/actions/runs/${runId}` : '';
  const runLinkText = runUrl ? `([View GitHub Actions Run](${runUrl}))` : '';

  let verdict = '';
  if (allPassed) {
    verdict = `🎉 **All CI checks passed successfully! Build & test invariants are verified.** ${runLinkText}`;
  } else if (anyFailed) {
    const failedStages = [
      gitleaks === 'failure' && 'Gitleaks Secret Scan',
      audit === 'failure' && 'Dependency Audit',
      build === 'failure' && 'Build Compilation',
      test === 'failure' && 'Unit Tests',
    ]
      .filter(Boolean)
      .join(', ');

    verdict = `❌ **CI Pipeline failed at: ${failedStages}.** ${runLinkText}\nPlease check logs and apply required fixes before merging.`;
  } else {
    verdict = `⚠️ **CI finished with status: Gitleaks (${gitleaks}), Audit (${audit}), Build (${build}), Tests (${test}).** ${runLinkText}`;
  }

  interface ExtraStage { name: string; result: string; }
  let extraRows = '';
  if (extraStagesJson) {
    try {
      const parsed = JSON.parse(extraStagesJson) as ExtraStage[];
      if (Array.isArray(parsed)) {
        parsed.forEach((stage, idx) => {
          const badge = getStatusBadge(stage.result);
          const key = `extra_${stage.name.toLowerCase().replace(/\s+/g, '_')}`;
          const dur = durations[key] ? `\`${durations[key]}\`` : '—';
          extraRows += `\n| 🔹 **${4 + idx + 1}. ${stage.name}** | ${badge.icon} ${badge.text} | ${dur} | Custom CI stage |`;
        });
      }
    } catch {
      console.warn('⚠️ [ReviewGround] Could not parse extra-stages JSON — skipping extra rows.');
    }
  }

  return `${CI_SECTION_HEADER}

| Pipeline Stage | Status | Duration | Verification Summary |
|---|:---:|:---:|---|
| 🐍 **1. Gitleaks Secret Scan** | ${gBadge.icon} ${gBadge.text} | ${gDur} | Secret, token & credential leak detection |
| 🐍 **2. Dependency Audit** | ${aBadge.icon} ${aBadge.text} | ${aDur} | Security vulnerability & zero-CVE audit |
| 🐍 **3. Build & Compilation** | ${bBadge.icon} ${bBadge.text} | ${bDur} | Clean build compilation & type safety |
| 🐍 **4. Test Verification** | ${tBadge.icon} ${tBadge.text} | ${tDur} | Unit tests & invariant suites |${extraRows}

${verdict}`;
}

export function buildDynamicCiSummaryMarkdown(
  jobs: DiscoveredCiJob[],
  runId?: string,
  repo?: string,
  extraStagesJson?: string
): string {
  const runUrl = runId && repo ? `https://github.com/${repo}/actions/runs/${runId}` : '';
  const runLinkText = runUrl ? `([View GitHub Actions Run](${runUrl}))` : '';

  let allPassed = jobs.length > 0;
  const failedJobs: string[] = [];
  const inProgressJobs: string[] = [];

  let rows = '';
  jobs.forEach((job, idx) => {
    const badge = getStatusBadge(job.conclusion);
    if (job.conclusion === 'failure') {
      allPassed = false;
      failedJobs.push(job.name);
    } else if (job.conclusion === 'in_progress' || job.status === 'in_progress') {
      allPassed = false;
      inProgressJobs.push(job.name);
    } else if (job.conclusion !== 'success') {
      allPassed = false;
    }

    const dur = job.duration !== '—' ? `\`${job.duration}\`` : '—';
    const logLink = job.url ? `[View Logs](${job.url})` : '—';
    rows += `\n| 🧪 **${idx + 1}. ${job.name}** | ${badge.icon} ${badge.text} | ${dur} | ${logLink} |`;
  });

  if (extraStagesJson) {
    try {
      const parsed = JSON.parse(extraStagesJson) as Array<{ name: string; result: string }>;
      if (Array.isArray(parsed)) {
        parsed.forEach((stage, idx) => {
          const badge = getStatusBadge(stage.result);
          if (stage.result !== 'success') {
            allPassed = false;
            if (stage.result === 'failure') failedJobs.push(stage.name);
          }
          rows += `\n| 🔹 **${jobs.length + idx + 1}. ${stage.name}** | ${badge.icon} ${badge.text} | — | Custom CI stage |`;
        });
      }
    } catch {
      console.warn('⚠️ [ReviewGround] Could not parse extra-stages JSON — skipping extra rows.');
    }
  }

  let verdict = '';
  if (allPassed && (jobs.length > 0 || Boolean(extraStagesJson))) {
    verdict = `🎉 **All CI checks passed successfully! (${jobs.length} jobs verified).** ${runLinkText}`;
  } else if (failedJobs.length > 0) {
    verdict = `❌ **CI Pipeline failed at: ${failedJobs.join(', ')}.** ${runLinkText}\nPlease check logs and apply required fixes before merging.`;
  } else if (inProgressJobs.length > 0) {
    verdict = `⏳ **CI Pipeline is in progress (${inProgressJobs.join(', ')}).** ${runLinkText}`;
  } else {
    verdict = `⚠️ **CI finished with mixed status.** ${runLinkText}`;
  }

  return `${CI_SECTION_HEADER}

| Pipeline Stage / Job | Status | Duration | Verification Logs |
|---|:---:|:---:|---|${rows}

${verdict}`;
}

export async function runSummary(config: SummaryConfig = {}): Promise<string> {
  const token = (config.githubToken || process.env.GITHUB_TOKEN || '').trim();
  const repo = (config.repo || process.env.REPO_FULL_NAME || process.env.GITHUB_REPOSITORY || '').trim();
  const prNumber = (config.prNumber || process.env.PR_NUMBER || '').trim();
  const runId = (config.runId || process.env.RUN_ID || process.env.GITHUB_RUN_ID || '').trim();
  const commentTag = config.commentTag || DEFAULT_COMMENT_TAG;

  const gitleaksRaw = (config.gitleaksResult || process.env.GITLEAKS_RESULT || '').trim();
  const auditRaw = (config.auditResult || process.env.AUDIT_RESULT || '').trim();
  const buildRaw = (config.buildResult || process.env.BUILD_RESULT || '').trim();
  const testRaw = (config.testResult || process.env.TEST_RESULT || '').trim();
  const extraStagesRaw = (config.extraStages || process.env.REVIEWGROUND_EXTRA_STAGES || process.env.EXTRA_STAGES || '').trim();

  // 1. Live Job Auto-Discovery & Duration mapping
  const discoveredJobs = await fetchWorkflowRunJobs(repo, runId, token);
  if (discoveredJobs.length > 0) {
    console.log(`- Discovered Workflow Jobs (${discoveredJobs.length}): ${discoveredJobs.map((j) => j.name).join(', ')}`);
  }
  const durations = await fetchStageDurations(repo, runId, token);

  const hasData = hasCiData(
    gitleaksRaw,
    auditRaw,
    buildRaw,
    testRaw,
    extraStagesRaw,
    durations,
    discoveredJobs.length
  );

  if (!hasData && config.mode !== 'summary') {
    console.log(`ℹ️  [ReviewGround] No CI verification stage inputs or external workflow jobs detected. Smart skipping Post-CI summary table in '${config.mode || 'all'}' mode.`);
    return '';
  }

  const hasExplicitInputs = Boolean(
    (gitleaksRaw && gitleaksRaw !== 'unknown' && gitleaksRaw.length > 0) ||
    (auditRaw && auditRaw !== 'unknown' && auditRaw.length > 0) ||
    (buildRaw && buildRaw !== 'unknown' && buildRaw.length > 0) ||
    (testRaw && testRaw !== 'unknown' && testRaw.length > 0)
  );

  let summaryMarkdown = '';
  if (hasExplicitInputs) {
    const gitleaks = gitleaksRaw || 'unknown';
    const audit = auditRaw || 'unknown';
    const build = buildRaw || 'unknown';
    const test = testRaw || 'unknown';

    console.log('📊 [ReviewGround] Generating Post-CI Summary (Explicit Stages)...');
    console.log(`- Gitleaks Result: ${gitleaks}`);
    console.log(`- Dependency Audit Result: ${audit}`);
    console.log(`- Build Result: ${build}`);
    console.log(`- Test Result: ${test}`);
    console.log('- Stage Durations:', JSON.stringify(durations));

    summaryMarkdown = buildCiSummaryMarkdown(
      gitleaks,
      audit,
      build,
      test,
      durations,
      runId,
      repo,
      extraStagesRaw || undefined
    );
  } else if (discoveredJobs.length > 0) {
    console.log(`📊 [ReviewGround] Generating Post-CI Summary dynamically for ${discoveredJobs.length} workflow job(s)...`);
    summaryMarkdown = buildDynamicCiSummaryMarkdown(
      discoveredJobs,
      runId,
      repo,
      extraStagesRaw || undefined
    );
  } else {
    summaryMarkdown = buildDynamicCiSummaryMarkdown(
      [],
      runId,
      repo,
      extraStagesRaw || undefined
    );
  }

  // Console output
  console.log('\n================== 🚦 CI SUMMARY ==================\n');
  console.log(summaryMarkdown);
  console.log('====================================================\n');

  // Step Summary
  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile && fs.existsSync(stepSummaryFile)) {
    await fs.promises.appendFile(stepSummaryFile, `\n\n${summaryMarkdown}\n`);
    console.log('✅ CI Summary appended to GitHub Actions step summary.');
  }

  // Update or create Sticky PR Comment
  await updateOrCreateStickyComment(summaryMarkdown, token, repo, prNumber, commentTag);

  return summaryMarkdown;
}
