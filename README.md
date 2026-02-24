# PipelineFactory (Phase 2 — Greybox Factory)

Monorepo:
- `apps/event-hub` — GitHub webhook → canonical events → WS broadcast + `/state` snapshot
- `apps/factory-ui` — Three.js greybox factory UI (wallboard/laptop/mobile modes)

## LAN run (target host: `192.168.200.25`)

### 1) Install

```bash
cd /path/to/pipeline-factory-agent-package
npm i
```

### 2) Start Event Hub (port `8080`)

```bash
cd apps/event-hub
export GITHUB_WEBHOOK_SECRET="<your webhook secret>"
# dev (watch)
npm run dev
# or production:
# npm run build && npm run start
```

Health endpoints:
- `http://192.168.200.25:8080/health`
- `http://192.168.200.25:8080/state`
- WS: `ws://192.168.200.25:8080/ws`

### 3) Start Factory UI (port `3010`)

```bash
cd apps/factory-ui
# optional: force hub host from a LAN client
export VITE_HUB_HOST=192.168.200.25
npm run dev
```

Open from any LAN device:
- `http://192.168.200.25:3010`

Mode selection:
- Wallboard: `http://192.168.200.25:3010/?mode=wallboard`
- Laptop: `http://192.168.200.25:3010/?mode=laptop`
- Mobile: `http://192.168.200.25:3010/?mode=mobile`

## Ops runbook (basic)

### Restart (dev)

From repo root:

```bash
# Event hub (port 8080)
cd apps/event-hub && npm run dev

# Factory UI (port 3010)
cd ../factory-ui && npm run dev
```

### Restart (production-style)

```bash
# Build everything
cd /path/to/pipeline-factory-agent-package
npm run build

# Start event hub
cd apps/event-hub
npm run start

# Serve UI build (Vite preview)
cd ../factory-ui
npm run preview
```

### Logs

- **Event hub:** stdout/stderr of the node process (or your process manager)
  - If using systemd: `journalctl -u <service-name> -f`
- **Factory UI:** browser console (client-side)

## Phase 2 verification checklist

Greybox world:
- [ ] All 6 stations visible with conveyors: RECEIVING_DOCK, BLUEPRINT_LOFT, ASSEMBLY_LINE, QA_GATE, LAUNCH_BAY, CONTROL_ROOM
- [ ] Each station has a visible camera anchor marker (pole + glowing bulb)

UI modes:
- [ ] Wallboard mode auto-tours all stations (8s each) and ignores pointer/touch interaction
- [ ] Laptop mode: click a station to zoom camera; click a module sphere to show PR card
- [ ] Mobile mode: swipe left/right cycles stations; module card is compact

Event-driven routing (send real webhooks or replay from hub):
- [ ] `CODE_PUSHED` spawns a burst of crates at RECEIVING_DOCK and routes them to ASSEMBLY_LINE
- [ ] `PR_OPENED`/`PR_UPDATED` routes a glowing module to BLUEPRINT_LOFT
- [ ] `CI_STARTED` routes a module into QA_GATE
- [ ] `CI_COMPLETED` success shows green-ish QA sparks + routes onward; failure shows red sparks + routes back to ASSEMBLY_LINE (rework)
- [ ] `RELEASE_PUBLISHED` triggers a LAUNCH_BAY rocket launch animation
