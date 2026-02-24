import * as THREE from 'three';

import { connectEventStream } from './net/EventStream';
import { FactoryState } from './state/FactoryState';
import { bootScene } from './scene/SceneBootstrap';
import { detectMode } from './ui/modes/mode';
import { WallboardTour } from './ui/modes/wallboard';
import { setConn, setDisconnectedOverlay, renderEventFeed } from './ui/Overlay';

const app = document.getElementById('app')!;
const kpisEl = document.getElementById('kpis')!;
const connEl = document.getElementById('conn')!;
const feedEl = document.getElementById('feed')!;
const overlayEl = document.getElementById('overlay')!;

const state = new FactoryState();
const scene = bootScene(app);

const mode = detectMode();

function renderKpis() {
  const k = state.kpis;
  kpisEl.innerHTML = `
    <div class="small">open PRs: <b>${k.open_prs}</b></div>
    <div class="small">failing checks: <b>${k.failing_checks}</b></div>
    <div class="small">last release: <b>${k.last_release ?? '-'}</b></div>
    <div class="small">avg CI: <b>${k.avg_ci_duration_ms ?? '-'}ms</b></div>
  `;
}

function renderFeed() {
  renderEventFeed(
    feedEl,
    state.recent.map((e) => ({ ts: e.ts, type: e.type, status: e.status, repo: `${e.org}/${e.repo}` }))
  );
}

renderKpis();
renderFeed();

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
      renderFeed();
    }
  })
  .catch(() => {});

// Wallboard tour loop
let tour: WallboardTour | null = null;
if (mode === 'wallboard') {
  const stops = scene.world.stations.map((s) => ({
    id: s.id,
    pos: s.anchor.position.clone(),
    lookAt: new THREE.Vector3(s.group.position.x, 1.2, s.group.position.z),
    seconds: 8,
  }));
  tour = new WallboardTour(scene.rig, stops);
}

// Laptop/mobile interaction
let selectedStation: string | null = null;
window.addEventListener(
  'pointerdown',
  (ev) => {
    if (mode === 'wallboard') return;
    const st = scene.onPointer(ev);
    if (!st) return;
    selectedStation = st;
    const s = scene.world.stationById.get(st as any);
    if (!s) return;
    scene.rig.setTarget(s.anchor.position.clone(), new THREE.Vector3(s.group.position.x, 1.2, s.group.position.z));
  },
  { passive: true }
);

// Mobile station swipe (simple)
if (mode === 'mobile') {
  let x0: number | null = null;
  window.addEventListener('touchstart', (e) => (x0 = e.touches[0]?.clientX ?? null), { passive: true });
  window.addEventListener(
    'touchend',
    (e) => {
      if (x0 == null) return;
      const x1 = e.changedTouches[0]?.clientX ?? x0;
      const dx = x1 - x0;
      x0 = null;
      if (Math.abs(dx) < 40) return;
      const ids = scene.world.stations.map((s) => s.id);
      const curIdx = selectedStation ? Math.max(0, ids.indexOf(selectedStation as any)) : 0;
      const dir = dx < 0 ? 1 : -1;
      const nextIdx = (curIdx + dir + ids.length) % ids.length;
      const next = ids[nextIdx];
      selectedStation = next;
      const s = scene.world.stationById.get(next);
      if (!s) return;
      scene.rig.setTarget(s.anchor.position.clone(), new THREE.Vector3(s.group.position.x, 1.2, s.group.position.z));
    },
    { passive: true }
  );
}

connectEventStream({
  wsUrl: hubWs,
  onStatus: (s) => {
    setConn(connEl, s);
    setDisconnectedOverlay(overlayEl, s !== 'connected');
  },
  onEvent: (ev) => {
    state.applyEvent(ev);
    renderKpis();
    renderFeed();

    if (tour) tour.tick(0); // no-op; tour ticks in RAF (below)

    if (ev.station_hint) {
      const ok = ev.status !== 'failure';
      scene.flashStation(ev.station_hint as any, ok);
    }
  },
});

// tick: tour
let t0 = performance.now();
function uiTick() {
  const t = performance.now();
  const dt = (t - t0) / 1000;
  t0 = t;
  if (tour) tour.tick(dt);
  requestAnimationFrame(uiTick);
}
requestAnimationFrame(uiTick);
