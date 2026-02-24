import type { CanonicalEvent } from '../github/normalize.js';

export type KPIs = {
  open_prs: number;
  failing_checks: number;
  last_release: string | null;
  avg_ci_duration_ms: number | null;
};

type PRKey = string; // org/repo#number
type CIKey = string; // org/repo|workflow|branch

export function computeKpis(events: CanonicalEvent[]): KPIs {
  const prOpen = new Map<PRKey, boolean>();
  const ciLatest = new Map<CIKey, { ts: number; status: 'success' | 'failure' | 'warning' | 'info' }>();

  let last_release: { ts: number; tag: string } | null = null;

  // average across completed runs with durations
  let durSum = 0;
  let durN = 0;

  for (const ev of events) {
    // PRs: treat OPENED/UPDATED as "open", CLOSED as "closed"
    if (ev.entity.kind === 'pull_request') {
      const prKey: PRKey = `${ev.org}/${ev.repo}#${ev.entity.key}`;
      if (ev.type === 'PR_OPENED' || ev.type === 'PR_UPDATED') prOpen.set(prKey, true);
      if (ev.type === 'PR_CLOSED') prOpen.set(prKey, false);
    }

    // Checks: track latest completion state per workflow+branch
    if (ev.type === 'CI_COMPLETED') {
      const meta: any = ev.meta || {};
      const workflow = typeof meta.workflow === 'string' ? meta.workflow : 'unknown';
      const branch = typeof meta.branch === 'string' ? meta.branch : 'unknown';
      const ciKey: CIKey = `${ev.org}/${ev.repo}|${workflow}|${branch}`;
      ciLatest.set(ciKey, { ts: ev.ts, status: ev.status });

      const d = meta.duration_ms;
      if (typeof d === 'number' && Number.isFinite(d) && d >= 0) {
        durSum += d;
        durN += 1;
      }
    }

    if (ev.type === 'RELEASE_PUBLISHED') {
      const tag = ev.entity.key;
      if (!last_release || ev.ts >= last_release.ts) last_release = { ts: ev.ts, tag };
    }
  }

  let open_prs = 0;
  for (const isOpen of prOpen.values()) if (isOpen) open_prs += 1;

  let failing_checks = 0;
  for (const st of ciLatest.values()) if (st.status === 'failure') failing_checks += 1;

  const avg_ci_duration_ms = durN ? Math.round(durSum / durN) : null;

  return {
    open_prs,
    failing_checks,
    last_release: last_release?.tag ?? null,
    avg_ci_duration_ms,
  };
}
