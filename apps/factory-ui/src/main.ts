import { connectEventStream } from './net/EventStream';
import { FactoryState } from './state/FactoryState';
import { bootScene } from './scene/SceneBootstrap';

const app = document.getElementById('app')!;
const kpisEl = document.getElementById('kpis')!;
const connEl = document.getElementById('conn')!;

const nowEl = document.getElementById('now')!;
const deployEl = document.getElementById('deploy')!;
const ciEl = document.getElementById('ci')!;
const dodEl = document.getElementById('dod')!;
const nextWrap = document.getElementById('nextWrap')!;
const nextEl = document.getElementById('next')!;
const blockersWrap = document.getElementById('blockersWrap')!;
const blockersEl = document.getElementById('blockers')!;

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

type HubStatus = {
  current: string | null;
  next: string[];
  blockers: string[];
  dod: { overall: 'DONE' | 'NOT DONE'; items: { id: string; title: string; status: 'done' | 'partial' | 'not_done'; evidence?: { title: string; url: string }[] }[] };
  deploy: { sha: string | null; deployedAt: string | null };
  ci: { status: 'success' | 'failure' | 'unknown'; url: string | null; updatedAt: string | null };
};

function badge(s: 'done' | 'partial' | 'not_done') {
  if (s === 'done') return '✅';
  if (s === 'partial') return '🟡';
  return '❌';
}

function renderStatus(st: HubStatus | null) {
  if (!st) return;

  nowEl.textContent = st.current || '-';

  const sha = st.deploy.sha ? st.deploy.sha : '-';
  const at = st.deploy.deployedAt ? st.deploy.deployedAt : '';
  deployEl.textContent = at ? `${sha} @ ${at}` : sha;

  const ciTxt = st.ci.status.toUpperCase();
  if (st.ci.url) {
    ciEl.innerHTML = `<a href="${st.ci.url}" target="_blank" rel="noreferrer">${ciTxt}</a>`;
  } else {
    ciEl.textContent = ciTxt;
  }

  dodEl.textContent = st.dod.overall;

  // next
  nextEl.innerHTML = '';
  if (st.next && st.next.length) {
    nextWrap.style.display = '';
    for (const t of st.next) {
      const li = document.createElement('li');
      li.textContent = t;
      nextEl.appendChild(li);
    }
  } else {
    nextWrap.style.display = 'none';
  }

  // blockers
  blockersEl.innerHTML = '';
  if (st.blockers && st.blockers.length) {
    blockersWrap.style.display = '';
    for (const b of st.blockers) {
      const li = document.createElement('li');
      li.textContent = b;
      blockersEl.appendChild(li);
    }
  } else {
    blockersWrap.style.display = 'none';
  }

  // expand DoD into title tooltip-like (simple)
  const lines = st.dod.items.map((i) => `${badge(i.status)} ${i.title}`).join('\n');
  dodEl.title = lines;
}

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

// Status panel polling
function pollStatus() {
  fetch(`${hubHttp}/status`, { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<HubStatus>) : null))
    .then((st) => renderStatus(st))
    .catch(() => {});
}

pollStatus();
setInterval(pollStatus, 2000);

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
