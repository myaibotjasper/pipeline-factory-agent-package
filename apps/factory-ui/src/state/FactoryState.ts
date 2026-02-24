import type { CanonicalEvent } from '../net/EventStream';

export type KPI = {
  open_prs: number;
  failing_checks: number;
  last_release: string | null;
  avg_ci_duration_ms: number | null;
};

export class FactoryState {
  kpis: KPI = { open_prs: 0, failing_checks: 0, last_release: null, avg_ci_duration_ms: null };
  recent: CanonicalEvent[] = [];

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
