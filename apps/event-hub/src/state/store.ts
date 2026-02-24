import type { CanonicalEvent } from '../github/normalize.js';

export type Module = {
  key: string;
  title?: string;
  url?: string;
  status: 'info' | 'success' | 'failure' | 'warning';
  zone?: string;
  updated_ts: number;
};

export type StateSnapshot = {
  ts: number;
  kpis: {
    open_prs: number;
    failing_checks: number;
    last_release: string | null;
    avg_ci_duration_ms: number | null;
  };
  modules: Module[];
  recent: CanonicalEvent[];
};

export class Store {
  private events: CanonicalEvent[] = [];
  private modules = new Map<string, Module>();

  constructor(private maxEvents = 300) {}

  push(ev: CanonicalEvent) {
    this.events.push(ev);
    if (this.events.length > this.maxEvents) this.events.shift();

    // minimal module mapping
    if (ev.entity.kind === 'pull_request') {
      const key = `pr:${ev.org}/${ev.repo}#${ev.entity.key}`;
      const cur = this.modules.get(key);
      const next: Module = {
        key,
        title: ev.entity.title,
        url: ev.entity.url,
        status: ev.status,
        zone: ev.station_hint,
        updated_ts: ev.ts,
      };
      this.modules.set(key, { ...(cur || {}), ...next });
    }

    if (ev.type === 'RELEASE_PUBLISHED') {
      const key = `release:${ev.org}/${ev.repo}:${ev.entity.key}`;
      this.modules.set(key, {
        key,
        title: ev.entity.title,
        url: ev.entity.url,
        status: ev.status,
        zone: ev.station_hint,
        updated_ts: ev.ts,
      });
    }
  }

  snapshot(): StateSnapshot {
    const recent = [...this.events].slice(-this.maxEvents);

    // KPIs (minimal)
    let open_prs = 0;
    let failing_checks = 0;
    let last_release: string | null = null;
    let avg_ci_duration_ms: number | null = null;
    let durSum = 0;
    let durN = 0;

    for (const ev of recent) {
      if (ev.type === 'PR_OPENED') open_prs += 1;
      if (ev.type === 'PR_CLOSED' && ev.status === 'success') open_prs = Math.max(0, open_prs - 1);
      if (ev.type === 'CI_COMPLETED' && ev.status === 'failure') failing_checks += 1;
      if (ev.type === 'RELEASE_PUBLISHED') last_release = ev.entity.key;
      const d = (ev.meta as any)?.duration_ms;
      if (ev.type === 'CI_COMPLETED' && typeof d === 'number') {
        durSum += d;
        durN += 1;
      }
    }
    if (durN) avg_ci_duration_ms = Math.round(durSum / durN);

    return {
      ts: Date.now(),
      kpis: { open_prs, failing_checks, last_release, avg_ci_duration_ms },
      modules: Array.from(this.modules.values()).sort((a, b) => b.updated_ts - a.updated_ts).slice(0, 200),
      recent,
    };
  }
}
