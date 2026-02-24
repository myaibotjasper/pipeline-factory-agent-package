# PipelineFactory — Full Blueprint (Three.js + GitHub Actions + Cute Robots)

## Goal
Build a responsive web app that renders a 3D cute-robot factory representing a GitHub delivery pipeline. GitHub webhooks stream events into an Event Hub that normalizes them into a compact internal schema. The frontend subscribes via WebSocket (or SSE), updates live Factory State, and triggers station animations (intake → blueprint → build → QA → release → metrics/control room).

## Target runtime
- Host: Mac mini M4, 24GB unified memory
- Clients: Wallboard browser, laptops, mobile browsers
- Renderer: Three.js WebGL (stable across devices)
- Realtime: WebSocket preferred (SSE acceptable)

---

# System Architecture

## Components
1) Event Hub (Node.js + TypeScript)
- Receives GitHub webhooks
- Verifies signatures
- Normalizes payload → canonical event schema
- Applies to state store (+ replay buffer)
- Broadcasts canonical events to clients

2) Factory UI (TypeScript + Three.js + Vite/Next)
- Loads factory zones + cute robot characters (glTF)
- Subscribes to event stream
- Updates runtime state & triggers animations
- Supports 3 UI modes: wallboard/laptop/mobile

## Data flow
GitHub → Webhook → Event Hub normalize → Event stream → Client state update → Animation trigger → KPI overlay update

---

# GitHub Integration (Actions CI)

## Webhooks to enable (minimum viable)
- push
- pull_request
- workflow_run            (GitHub Actions)
- check_suite             (often produced by Actions; broad CI status)
- check_run               (optional granular)
- release

## Security
- Verify X-Hub-Signature-256 using shared secret (HMAC SHA-256)
- Reject invalid signatures (401)

## Normalization strategy
Normalize all GitHub payloads into a few canonical pipeline event types:
- CODE_PUSHED
- PR_OPENED / PR_UPDATED / PR_CLOSED
- CI_STARTED / CI_COMPLETED
- RELEASE_PUBLISHED
- HEARTBEAT (hub-generated)

Prefer `workflow_run` for Actions start/complete timings.
Use `check_suite` / `check_run` for per-PR “gate result” (success/failure) when present.

---

# Canonical Event Schema (Contract)
See agent_spec.json for full schema and enums.

---

# Factory Visualization

## Stations (Zones)
A) RECEIVING_DOCK — intake
B) BLUEPRINT_LOFT — planning/PR framing
C) ASSEMBLY_LINE — build activity
D) QA_GATE — CI checks and gating
E) LAUNCH_BAY — release publishing/shipping
F) CONTROL_ROOM — KPI dashboards + global mode lighting

## Data metaphors
- PR = glowing feature module
- Commit/push = parts crate burst delivered to assembly
- CI pass = green gate + sparkle
- CI fail = comedic sparks + rework chute
- Release = packaging + drone/rocket launch
- Bottleneck = slower belts + “queue stacks” visual

---

# UI Modes

## Wallboard mode
- Auto camera tour loop across stations
- Large KPIs: open PRs, failing checks, last release, avg CI duration
- No interaction; always-on

## Laptop mode
- Click station to zoom
- Click module to show PR card (title, status, link)
- Optional repo filter if multi-repo

## Mobile mode
- One station per page, swipe stations
- Tap module for compact PR card

---

# Performance Budgets (hard gates)
- Wallboard: target 60fps, ≤250 draw calls, ≤40 robots
- Laptop: target 60fps, ≤150 draw calls, ≤25 robots
- Mobile: target 30fps, ≤100 draw calls, ≤12 robots

Dynamic degradation ladder:
1) reduce particles
2) disable real-time shadows
3) disable postprocessing
4) reduce visible robots (crowd → impostors)
5) lower texture set

---

# Build Order (agent must follow)
Phase 1 — Skeleton
1) Monorepo: apps/event-hub + apps/factory-ui
2) Webhook receiver + signature verification
3) Canonical events + WS broadcast + replay buffer
4) Frontend connects & logs events + loads a basic scene

Phase 2 — Greybox factory
5) Greybox zones with anchors and conveyors
6) Camera tour + UI modes
7) Crate/module spawning + station routing

Phase 3 — Robots & animation
8) Import robot base rig + role props
9) Implement animation controller per robot role
10) Bind canonical events → station + robot reactions

Phase 4 — KPIs
11) KPI aggregator (hub or client)
12) UI overlays per mode

Phase 5 — Optimization
13) KTX2 textures + LODs + instancing
14) Lighting modes (normal/incident/celebration)
15) Robust reconnect + “Disconnected” overlay

---

# Acceptance Criteria
A) Wallboard runs 10 min continuously, tour loops, updates within 2s of events.
B) Laptop: station zoom + module click shows PR details.
C) Mobile: smooth swipe between stations, compact event feed.
D) Signature verification, reconnect, safe payload handling.
