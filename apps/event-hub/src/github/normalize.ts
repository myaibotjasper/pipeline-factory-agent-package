import { randomUUID } from 'node:crypto';

export type CanonicalType =
  | 'CODE_PUSHED'
  | 'PR_OPENED'
  | 'PR_UPDATED'
  | 'PR_CLOSED'
  | 'CI_STARTED'
  | 'CI_COMPLETED'
  | 'RELEASE_PUBLISHED'
  | 'HEARTBEAT';

export type CanonicalStatus = 'info' | 'success' | 'failure' | 'warning';

export type CanonicalEvent = {
  id: string;
  ts: number;
  source: 'github';
  org: string;
  repo: string;
  type: CanonicalType;
  status: CanonicalStatus;
  entity: {
    kind: 'pull_request' | 'commit_batch' | 'release' | 'unknown';
    key: string;
    title?: string;
    url?: string;
  };
  station_hint?:
    | 'RECEIVING_DOCK'
    | 'BLUEPRINT_LOFT'
    | 'ASSEMBLY_LINE'
    | 'QA_GATE'
    | 'LAUNCH_BAY'
    | 'CONTROL_ROOM';
  meta?: Record<string, unknown>;
};

function base(org: string, repo: string, type: CanonicalType): CanonicalEvent {
  return {
    id: randomUUID(),
    ts: Date.now(),
    source: 'github',
    org,
    repo,
    type,
    status: 'info',
    entity: { kind: 'unknown', key: 'unknown' },
  };
}

export function normalizeGithubEvent(evtName: string, payload: any): CanonicalEvent[] {
  const repoFull = payload?.repository?.full_name || '';
  const [org, repo] = repoFull.includes('/') ? repoFull.split('/') : ['unknown', 'unknown'];

  if (evtName === 'push') {
    const e = base(org, repo, 'CODE_PUSHED');
    e.station_hint = 'RECEIVING_DOCK';
    const commits = Array.isArray(payload?.commits) ? payload.commits.length : undefined;
    const ref = payload?.ref;
    const sha = payload?.after;
    e.entity = { kind: 'commit_batch', key: sha || ref || 'push' };
    e.meta = { commit_count: commits, ref };
    return [e];
  }

  if (evtName === 'pull_request') {
    const action = payload?.action;
    const pr = payload?.pull_request;
    const number = pr?.number ?? payload?.number;
    const title = pr?.title;
    const url = pr?.html_url;

    if (action === 'opened') {
      const e = base(org, repo, 'PR_OPENED');
      e.station_hint = 'BLUEPRINT_LOFT';
      e.entity = { kind: 'pull_request', key: String(number), title, url };
      return [e];
    }

    if (['ready_for_review', 'reopened', 'synchronize', 'edited'].includes(action)) {
      const e = base(org, repo, 'PR_UPDATED');
      e.station_hint = 'BLUEPRINT_LOFT';
      e.entity = { kind: 'pull_request', key: String(number), title, url };
      return [e];
    }

    if (action === 'closed') {
      const merged = !!pr?.merged;
      const e = base(org, repo, 'PR_CLOSED');
      e.station_hint = merged ? 'LAUNCH_BAY' : 'BLUEPRINT_LOFT';
      e.status = merged ? 'success' : 'info';
      e.entity = { kind: 'pull_request', key: String(number), title, url };
      e.meta = { merged };
      return [e];
    }
  }

  if (evtName === 'workflow_run') {
    const wr = payload?.workflow_run;
    const status = wr?.status;
    const conclusion = wr?.conclusion;
    const eType: CanonicalType = status === 'completed' ? 'CI_COMPLETED' : 'CI_STARTED';
    const e = base(org, repo, eType);
    e.station_hint = 'QA_GATE';
    e.entity = { kind: 'commit_batch', key: String(wr?.id ?? 'workflow_run'), title: wr?.name, url: wr?.html_url };

    if (eType === 'CI_COMPLETED') {
      if (conclusion === 'success') e.status = 'success';
      else if (['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure'].includes(conclusion)) e.status = 'failure';
      else if (['neutral', 'skipped'].includes(conclusion)) e.status = 'warning';
      else e.status = 'info';

      const started = Date.parse(wr?.run_started_at || '') || 0;
      const completed = Date.parse(wr?.updated_at || wr?.completed_at || '') || 0;
      if (started && completed && completed >= started) {
        e.meta = { ...(e.meta || {}), duration_ms: completed - started };
      }
    }

    e.meta = { ...(e.meta || {}), workflow: wr?.name, branch: wr?.head_branch, run_id: wr?.id };
    return [e];
  }

  if (evtName === 'release') {
    const action = payload?.action;
    if (action === 'published') {
      const rel = payload?.release;
      const e = base(org, repo, 'RELEASE_PUBLISHED');
      e.station_hint = 'LAUNCH_BAY';
      e.status = 'success';
      e.entity = { kind: 'release', key: String(rel?.tag_name ?? 'release'), title: rel?.name, url: rel?.html_url };
      return [e];
    }
  }

  return [];
}
