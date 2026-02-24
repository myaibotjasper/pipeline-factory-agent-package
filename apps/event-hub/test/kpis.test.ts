import test from 'node:test';
import assert from 'node:assert/strict';

import type { CanonicalEvent } from '../src/github/normalize.js';
import { computeKpis } from '../src/state/kpis.js';

function ev(partial: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    id: partial.id ?? 'id',
    ts: partial.ts ?? 0,
    source: 'github',
    org: partial.org ?? 'acme',
    repo: partial.repo ?? 'rocket',
    type: partial.type ?? 'HEARTBEAT',
    status: partial.status ?? 'info',
    entity: partial.entity ?? { kind: 'unknown', key: 'unknown' },
    station_hint: partial.station_hint,
    meta: partial.meta,
  };
}

test('computeKpis aggregates open PRs, failing checks, last release, avg CI duration', () => {
  const events: CanonicalEvent[] = [
    ev({ ts: 1, type: 'PR_OPENED', entity: { kind: 'pull_request', key: '10', title: 'Add X' } }),
    ev({ ts: 2, type: 'PR_OPENED', entity: { kind: 'pull_request', key: '11', title: 'Fix Y' } }),
    ev({ ts: 3, type: 'PR_CLOSED', status: 'success', entity: { kind: 'pull_request', key: '10' }, meta: { merged: true } }),
    // reopen comes through as PR_UPDATED in our normalizer
    ev({ ts: 4, type: 'PR_UPDATED', entity: { kind: 'pull_request', key: '10' } }),

    // CI completed: one failure, then a later success for same workflow+branch should clear it
    ev({
      ts: 10,
      type: 'CI_COMPLETED',
      status: 'failure',
      entity: { kind: 'commit_batch', key: 'run1' },
      meta: { workflow: 'CI', branch: 'main', duration_ms: 1000 },
    }),
    ev({
      ts: 11,
      type: 'CI_COMPLETED',
      status: 'success',
      entity: { kind: 'commit_batch', key: 'run2' },
      meta: { workflow: 'CI', branch: 'main', duration_ms: 3000 },
    }),
    // another workflow stays failing
    ev({
      ts: 12,
      type: 'CI_COMPLETED',
      status: 'failure',
      entity: { kind: 'commit_batch', key: 'run3' },
      meta: { workflow: 'Lint', branch: 'main', duration_ms: 2000 },
    }),

    ev({ ts: 20, type: 'RELEASE_PUBLISHED', status: 'success', entity: { kind: 'release', key: 'v1.2.3' } }),
    ev({ ts: 21, type: 'RELEASE_PUBLISHED', status: 'success', entity: { kind: 'release', key: 'v1.2.4' } }),
  ];

  const k = computeKpis(events);

  assert.equal(k.open_prs, 2, 'PR #10 reopened and PR #11 still open');
  assert.equal(k.failing_checks, 1, 'only Lint/main is failing at end of stream');
  assert.equal(k.last_release, 'v1.2.4');
  assert.equal(k.avg_ci_duration_ms, 2000);
});
