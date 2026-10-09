/**
 * ReviewGround - Post-CI Sticky Summary & Verification Reporter
 * Summarizes Gitleaks, Dependency Audit, Build, and Unit Test results.
 * Tracks stage durations via the GitHub Actions API and updates the existing
 * single PR review comment (Sticky Comment pattern) without duplicate noise.
 */

import * as fs from 'fs';
import { DEFAULT_COMMENT_TAG, CI_SECTION_HEADER } from './reviewer.js';

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
  /** Optional extra CI stages beyond the default 4.
   * JSON string: [{"name":"Deploy","result":"success"},{"name":"E2E","result":"failure"}]
   */
  extraStages?: string;
  /** Execution mode ('review' | 'summary' | 'all') */
  mode?: string;
}

export interface StageDurations {
  [stageKey: string]: string | undefined;
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

export function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export interface DiscoveredCiJob {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  duration: string;
  url?: string;
}

/**
 * Determines whether any CI verification stage inputs or workflow jobs exist.
 * Used for smart auto-skipping empty "unknown" CI tables when ReviewGround runs in 'all' mode.
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

/**
 * Queries GitHub Actions Workflow Jobs API to discover all external jobs
 * in the current workflow run. Excludes ReviewGround's own review job.
 */
export async function fetchWorkflowRunJobs(
  repo?: string,
  runId?: string,
  token?: string
): Promise<DiscoveredCiJob[]> {
  if (!repo || !runId || !token) return [];

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ReviewGround-CI-Summary',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.warn(`ℹ️ Could not fetch workflow run jobs: HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      jobs?: Array<{
        id: number;
        name: string;
        status?: string;
        conclusion?: string | null;
        started_at?: string;
        completed_at?: string;
        html_url?: string;
      }>;
    };

    if (!Array.isArray(data.jobs)) return [];

    return data.jobs
      .filter((job) => {
        const lowerName = (job.name || '').toLowerCase();
        return !lowerName.includes('reviewground');
      })
      .map((job) => {
        let duration = '—';
        if (job.started_at && job.completed_at) {
          const ms = new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
          duration = formatDuration(ms);
        } else if (job.started_at) {
          duration = 'In Progress';
        }

        const conclusion =
          job.conclusion ||
          (job.status === 'in_progress' ? 'in_progress' : job.status || 'unknown');

        return {
          id: job.id,
          name: job.name,
          status: job.status || 'unknown',
          conclusion,
          duration,
          url: job.html_url,
        };
      });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`ℹ️ Could not fetch workflow run jobs: ${msg}`);
    return [];
  }
}

/**
 * Queries GitHub Actions Workflow Jobs API to compute human-readable duration metrics
 * for every CI stage.
 */
export async function fetchStageDurations(
  repo?: string,
  runId?: string,
  token?: string
): Promise<StageDurations> {
  const durations: StageDurations = {};
  if (!repo || !runId || !token) return durations;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ReviewGround-CI-Summary',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.warn(`ℹ️ Could not fetch workflow run jobs for durations: HTTP ${res.status}`);
      return durations;
    }

    const data = (await res.json()) as {
      jobs?: Array<{
        name: string;
        started_at?: string;
        completed_at?: string;
      }>;
    };

    if (Array.isArray(data.jobs)) {
      for (const job of data.jobs) {
        if (!job.started_at || !job.completed_at) continue;
        const ms = new Date(job.completed_at).getTime() - new Date(job.started_at).getTime();
        const formatted = formatDuration(ms);
        const name = (job.name || '').toLowerCase();

        if (name.includes('gitleaks') && !durations.gitleaks) {
          durations.gitleaks = formatted;
        } else if (name.includes('audit') && !durations.audit) {
          durations.audit = formatted;
        } else if ((name.includes('build') || name.includes('compil')) && !durations.build) {
          durations.build = formatted;
        } else if (
          (name.includes('test') || name.includes('unit')) &&
          !durations.test &&
          !name.includes('build')
        ) {
          durations.test = formatted;
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`ℹ️ Could not fetch stage durations: ${msg}`);
  }

  return durations;
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

  // Parse optional extra stages from JSON string
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

/**
 * Renders a fully dynamic CI summary table discovering all workflow jobs
 * from the GitHub Actions API without hardcoding 4 fixed stages.
 */
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

  // Extra stages
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

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ReviewGround-CI-Summary',
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
        // Replace existing CI status block up to next section or tag
        const parts = updatedBody.split(CI_SECTION_HEADER);
        const beforeHeader = parts[0];
        // Retain COMMENT_TAG
        updatedBody = `${beforeHeader.trimEnd()}\n\n${ciSummaryMarkdown}\n\n${commentTag}`;
      } else {
        // Append before COMMENT_TAG
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

    // No existing comment with tag found, create a new one
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

  // 1. Live Job Auto-Discovery from GitHub Actions API
  const discoveredJobs = await fetchWorkflowRunJobs(repo, runId, token);
  if (discoveredJobs.length > 0) {
    console.log(`- Discovered Workflow Jobs (${discoveredJobs.length}): ${discoveredJobs.map((j) => j.name).join(', ')}`);
  }

  // 2. Duration mapping
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
    // Only extra stages or explicit mode='summary'
    summaryMarkdown = buildDynamicCiSummaryMarkdown(
      [],
      runId,
      repo,
      extraStagesRaw || undefined
    );
  }

  // 1. Output to console
  console.log('\n================== 🚦 CI SUMMARY ==================\n');
  console.log(summaryMarkdown);
  console.log('====================================================\n');

  // 2. Append to GitHub Actions Step Summary (async to avoid blocking event loop)
  const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryFile && fs.existsSync(stepSummaryFile)) {
    await fs.promises.appendFile(stepSummaryFile, `\n\n${summaryMarkdown}\n`);
    console.log('✅ CI Summary appended to GitHub Actions step summary.');
  }

  // 3. Update or create Sticky PR Comment
  await updateOrCreateStickyComment(summaryMarkdown, token, repo, prNumber, commentTag);

  return summaryMarkdown;
}
