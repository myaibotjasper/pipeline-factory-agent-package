import * as THREE from 'three';

import { connectEventStream } from './net/EventStream';
import { FactoryState } from './state/FactoryState';
import { bootScene } from './scene/SceneBootstrap';
import { detectMode } from './ui/modes/mode';
import { WallboardTour } from './ui/modes/wallboard';
import { setConn, setDisconnectedOverlay, renderEventFeed } from './ui/Overlay';

const app = document.getElementById('app')!;
const kpisEl = document.getElementById('kpis')!;
const stationsEl = document.getElementById('stations');
const connEl = document.getElementById('conn')!;
const feedEl = document.getElementById('feed')!;
const overlayEl = document.getElementById('overlay')!;

const state = new FactoryState();
const mode = detectMode();
document.body.dataset.mode = mode;
if (mode === 'mobile') kpisEl.classList.add('compact');
if (mode === 'wallboard') kpisEl.classList.add('wallboard');
const scene = bootScene(app, mode);

let lightingResetTimer: number | null = null;
function setLighting(mode: 'normal' | 'incident' | 'celebration', holdMs: number) {
  scene.setLightingMode(mode);
  if (lightingResetTimer != null) window.clearTimeout(lightingResetTimer);
  if (mode !== 'normal') {
    lightingResetTimer = window.setTimeout(() => scene.setLightingMode('normal'), holdMs);
  } else {
    lightingResetTimer = null;
  }
}

function renderKpis() {
  const k = state.kpis;

  if (mode === 'wallboard') {
    kpisEl.innerHTML = `
      <div class="kpiBig"><div class="label">OPEN PRs</div><div class="value">${k.open_prs}</div></div>
      <div class="kpiBig"><div class="label">FAILING</div><div class="value">${k.failing_checks}</div></div>
      <div class="kpiBig"><div class="label">LAST RELEASE</div><div class="value tag">${k.last_release ?? '-'}</div></div>
      <div class="kpiBig"><div class="label">AVG CI</div><div class="value">${k.avg_ci_duration_ms ?? '-'}<span class="unit">ms</span></div></div>
    `;
    return;
  }

  if (mode === 'mobile') {
    kpisEl.innerHTML = `
      <div class="small">PRs <b>${k.open_prs}</b></div>
      <div class="small">fail <b>${k.failing_checks}</b></div>
      <div class="small">rel <b>${k.last_release ?? '-'}</b></div>
      <div class="small">CI <b>${k.avg_ci_duration_ms ?? '-'}</b>ms</div>
    `;
    return;
  }

  // laptop
  kpisEl.innerHTML = `
    <div class="small">open PRs: <b>${k.open_prs}</b></div>
    <div class="small">failing checks: <b>${k.failing_checks}</b></div>
    <div class="small">last release: <b>${k.last_release ?? '-'}</b></div>
    <div class="small">avg CI: <b>${k.avg_ci_duration_ms ?? '-'}ms</b></div>
  `;
}

function renderStations() {
  if (!stationsEl) return;
  if (mode !== 'laptop') {
    stationsEl.innerHTML = '';
    return;
  }

  const zones = [
    'RECEIVING_DOCK',
    'BLUEPRINT_LOFT',
    'ASSEMBLY_LINE',
    'QA_GATE',
    'LAUNCH_BAY',
    'CONTROL_ROOM',
  ] as const;

  const mods = Array.isArray(state.modules) ? state.modules : [];

  function zoneStatus(z: string): 'failure' | 'warning' | 'info' | 'success' | 'idle' {
    const inZone = mods.filter((m) => m.zone === z);
    if (!inZone.length) return 'idle';
    if (inZone.some((m) => m.status === 'failure')) return 'failure';
    if (inZone.some((m) => m.status === 'warning')) return 'warning';
    if (inZone.some((m) => m.status === 'info')) return 'info';
    return 'success';
  }

  stationsEl.innerHTML = `
    <div style="font-weight:700; margin-bottom:6px;">Stations</div>
    ${zones
      .map((z) => {
        const st = zoneStatus(z);
        return `<div class="stationRow ${st}"><span class="name">${z.replace(/_/g, ' ')}</span><span class="st">${st}</span></div>`;
      })
      .join('')}
  `;
}

function renderFeed() {
  renderEventFeed(
    feedEl,
    state.recent.map((e) => ({ ts: e.ts, type: e.type, status: e.status, repo: `${e.org}/${e.repo}` }))
  );
}

renderKpis();
renderStations();
renderFeed();

const hubHost = import.meta.env.VITE_HUB_HOST || window.location.hostname;
const hubHttp = import.meta.env.VITE_HUB_HTTP_BASE || `http://${hubHost}:8080`;
const hubWs = import.meta.env.VITE_HUB_WS_URL || `ws://${hubHost}:8080/ws`;
const hubSse = import.meta.env.VITE_HUB_SSE_URL || `http://${hubHost}:8080/sse`;

// Fetch initial snapshot
fetch(`${hubHttp}/state`, { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : null))
  .then((snap) => {
    if (!snap) return;
    state.applySnapshot(snap);
    renderKpis();
    renderStations();
    renderFeed();
    if (Array.isArray(snap.modules)) {
      scene.moduleLayer.upsertMany(snap.modules);
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
const prCardEl = document.createElement('div');
prCardEl.className = mode === 'mobile' ? 'pill compact' : 'pill';
prCardEl.style.position = 'absolute';
prCardEl.style.right = '12px';
prCardEl.style.bottom = '12px';
prCardEl.style.width = 'min(460px, 92vw)';
prCardEl.style.display = 'none';
prCardEl.style.pointerEvents = 'auto';
prCardEl.innerHTML = '';
document.body.appendChild(prCardEl);

function showPrCard(m: any) {
  if (!m) {
    prCardEl.style.display = 'none';
    return;
  }
  const title = m.title || m.key;
  const url = m.url;
  prCardEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; gap:10px; align-items:baseline;">
      <div style="font-weight:700;">PR</div>
      <div class="small" style="opacity:0.8;">${m.status?.toUpperCase?.() || ''}</div>
    </div>
    <div style="margin-top:6px;">${title}</div>
    ${url ? `<div class="small" style="margin-top:6px;"><a href="${url}" target="_blank" rel="noreferrer">open on GitHub</a></div>` : ''}
  `;
  prCardEl.style.display = '';
}

window.addEventListener(
  'pointerdown',
  (ev) => {
    if (mode === 'wallboard') return;

    // module click (laptop/mobile)
    const modKey = scene.pickModule(ev);
    if (modKey) {
      const m = (state.modules || []).find((x) => x.key === modKey);
      showPrCard(m);
      return;
    }

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

let sse: EventSource | null = null;
let sseStarted = false;

function startSseFallback() {
  if (sseStarted) return;
  sseStarted = true;
  try {
    sse = new EventSource(hubSse);
    setConn(connEl, 'connected');
    setDisconnectedOverlay(overlayEl, false);

    sse.addEventListener('snapshot', (e: any) => {
      try {
        const snap = JSON.parse(String(e.data));
        if (Array.isArray(snap.recent)) {
          for (const ev of snap.recent) state.applyEvent(ev);
        }
        if (Array.isArray(snap.modules)) {
          state.modules = snap.modules;
          scene.moduleLayer.upsertMany(snap.modules);
        }
        renderKpis();
        renderStations();
        renderFeed();
      } catch {}
    });

    sse.addEventListener('event', (e: any) => {
      try {
        const ev = JSON.parse(String(e.data));
        handleEvent(ev);
      } catch {}
    });

    sse.onerror = () => {
      setConn(connEl, 'disconnected');
      setDisconnectedOverlay(overlayEl, true);
    };
  } catch {
    setConn(connEl, 'disconnected');
    setDisconnectedOverlay(overlayEl, true);
  }
}

function handleEvent(ev: any) {
  state.applyEvent(ev);
  renderKpis();
  renderStations();
  renderFeed();

  scene.robots.onEvent(ev);

  // lighting modes
  if (ev.type === 'CI_COMPLETED' && ev.status === 'failure') {
    setLighting('incident', 12000);
  } else if (ev.type === 'RELEASE_PUBLISHED') {
    setLighting('celebration', 15000);
  } else if (ev.type === 'CI_COMPLETED' && ev.status === 'success') {
    // settle back to normal quickly after a good run
    setLighting('normal', 0);
  }

  // keep module layer in sync (cheap: refresh from hub periodically would be better; for MVP we refetch snapshot)
  if (!sseStarted && (ev.type.startsWith('PR_') || ev.type === 'RELEASE_PUBLISHED')) {
    fetch(`${hubHttp}/state`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((snap) => {
        if (!snap) return;
        if (Array.isArray(snap.modules)) {
          state.modules = snap.modules;
          renderStations();
          scene.moduleLayer.upsertMany(snap.modules);
        }
      })
      .catch(() => {});
  }

  // event-driven routing (greybox)
  if (ev.type === 'CODE_PUSHED') {
    const n = Math.min(10, Math.max(3, Number((ev.meta as any)?.commit_count ?? 5)));
    scene.flow.spawnCrateBurst('RECEIVING_DOCK', 'ASSEMBLY_LINE', n);
  }

  if (ev.type === 'PR_OPENED' || ev.type === 'PR_UPDATED') {
    scene.flow.routeModule('RECEIVING_DOCK', 'BLUEPRINT_LOFT', ev.status);
  }

  if (ev.type === 'PR_CLOSED') {
    const merged = !!(ev.meta as any)?.merged;
    if (merged) scene.flow.routeModule('BLUEPRINT_LOFT', 'LAUNCH_BAY', 'success');
  }

  if (ev.type === 'CI_STARTED') {
    scene.flow.routeModule('ASSEMBLY_LINE', 'QA_GATE', 'info');
  }

  if (ev.type === 'CI_COMPLETED') {
    const ok = ev.status === 'success';
    scene.flow.qaResult(ok);
    if (ok) scene.flow.routeModule('QA_GATE', 'LAUNCH_BAY', ev.status);
    else scene.flow.routeModule('QA_GATE', 'ASSEMBLY_LINE', 'failure');
  }

  if (ev.type === 'RELEASE_PUBLISHED') {
    scene.flow.launchRocket();
  }

  if (ev.station_hint) {
    const ok = ev.status !== 'failure';
    scene.flashStation(ev.station_hint as any, ok);
  }
}

connectEventStream({
  wsUrl: hubWs,
  onStatus: (s) => {
    setConn(connEl, s);
    setDisconnectedOverlay(overlayEl, s !== 'connected');

    if (s === 'disconnected') {
      // If WS is blocked (common on some mobile networks), fall back to SSE.
      setTimeout(() => startSseFallback(), 1200);
    }
  },
  onEvent: (ev) => handleEvent(ev),
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
