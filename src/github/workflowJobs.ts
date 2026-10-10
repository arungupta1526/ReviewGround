/**
 * ReviewGround - CI Workflow Jobs & Stage Duration Metrics
 * Queries the GitHub Actions API to dynamically discover workflow jobs
 * and compute human-readable duration metrics for each CI stage.
 */

export interface DiscoveredCiJob {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  duration: string;
  url?: string;
}

export interface StageDurations {
  [stageKey: string]: string | undefined;
}

/**
 * Formats milliseconds into human-readable duration strings (e.g. "45s", "2m 15s").
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
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
