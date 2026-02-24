import { connectEventStream } from './net/EventStream';
import { FactoryState } from './state/FactoryState';
import { bootScene } from './scene/SceneBootstrap';

const app = document.getElementById('app')!;
const kpisEl = document.getElementById('kpis')!;
const connEl = document.getElementById('conn')!;

const state = new FactoryState();
const scene = bootScene(app);

function renderKpis() {
  const k = state.kpis;
  kpisEl.innerHTML = `
    <div class="small">open PRs: <b>${k.open_prs}</b></div>
    <div class="small">failing checks: <b>${k.failing_checks}</b></div>
    <div class="small">last release: <b>${k.last_release ?? '-'}</b></div>
    <div class="small">avg CI: <b>${k.avg_ci_duration_ms ?? '-'}ms</b></div>
  `;
}
renderKpis();

const hubHost = import.meta.env.VITE_HUB_HOST || window.location.hostname;
const hubHttp = import.meta.env.VITE_HUB_HTTP_BASE || `http://${hubHost}:8080`;
const hubWs = import.meta.env.VITE_HUB_WS_URL || `ws://${hubHost}:8080/ws`;

// Fetch initial snapshot
fetch(`${hubHttp}/state`, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((snap) => {
    if (!snap) return;
    if (Array.isArray(snap.recent)) {
      for (const ev of snap.recent) state.applyEvent(ev);
      renderKpis();
    }
  })
  .catch(() => {});

connectEventStream({
  wsUrl: hubWs,
  onStatus: (s) => {
    connEl.textContent = s.toUpperCase();
  },
  onEvent: (ev) => {
    state.applyEvent(ev);
    renderKpis();

    if (ev.station_hint) {
      const ok = ev.status !== 'failure';
      scene.flashStation(ev.station_hint, ok);
    }
  },
});
