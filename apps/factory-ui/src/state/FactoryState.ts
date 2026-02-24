import type { CanonicalEvent } from '../net/EventStream';

export type KPI = {
  open_prs: number;
  failing_checks: number;
  last_release: string | null;
  avg_ci_duration_ms: number | null;
};

export type Module = {
  key: string;
  title?: string;
  url?: string;
  status: 'info' | 'success' | 'failure' | 'warning';
  zone?: string;
  updated_ts: number;
};

export class FactoryState {
  kpis: KPI = { open_prs: 0, failing_checks: 0, last_release: null, avg_ci_duration_ms: null };
  recent: CanonicalEvent[] = [];
  modules: Module[] = [];

  applySnapshot(snap: any) {
    if (snap?.kpis) this.kpis = snap.kpis;
    if (Array.isArray(snap?.modules)) this.modules = snap.modules;
    if (Array.isArray(snap?.recent)) {
      this.recent = [];
      for (const ev of snap.recent) this.applyEvent(ev);
    }
  }

  applyEvent(ev: CanonicalEvent) {
    this.recent.push(ev);
    if (this.recent.length > 300) this.recent.shift();

    if (ev.type === 'PR_OPENED') this.kpis.open_prs += 1;
    if (ev.type === 'PR_CLOSED' && ev.status === 'success') this.kpis.open_prs = Math.max(0, this.kpis.open_prs - 1);
    if (ev.type === 'CI_COMPLETED' && ev.status === 'failure') this.kpis.failing_checks += 1;
    if (ev.type === 'RELEASE_PUBLISHED') this.kpis.last_release = ev.entity.key;

    const d = (ev.meta as any)?.duration_ms;
    if (ev.type === 'CI_COMPLETED' && typeof d === 'number') {
      // naive running avg over last N
      const last = this.recent.filter((e) => e.type === 'CI_COMPLETED' && typeof (e.meta as any)?.duration_ms === 'number').slice(-20);
      const sum = last.reduce((s, e) => s + Number((e.meta as any).duration_ms), 0);
      this.kpis.avg_ci_duration_ms = Math.round(sum / Math.max(1, last.length));
    }
  }
}
