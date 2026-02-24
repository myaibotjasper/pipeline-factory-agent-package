# AGENTS.md — Codex Instructions for PipelineFactory

You are building the complete PipelineFactory solution.

## Objective
Build a full working system consisting of:

1. Event Hub (Node.js + TypeScript)
   - Receives GitHub webhooks
   - Verifies X-Hub-Signature-256
   - Normalizes events into canonical schema (see agent_spec.json)
   - Streams events via WebSocket
   - Exposes GET /state snapshot
   - Maintains replay buffer (300 events)

2. Factory UI (Three.js WebGL + TypeScript)
   - Responsive: wallboard / laptop / mobile
   - Loads cute robot factory scene
   - Connects to WebSocket event stream
   - Applies canonical events to runtime state
   - Triggers zone animations per agent_spec.json
   - Implements 3 UI modes exactly as defined

GitHub CI source: GitHub Actions (workflow_run primary).

---

## REQUIRED READING (DO THIS FIRST)

Before writing code, read:

- spec/AGENT_BLUEPRINT.md
- spec/agent_spec.json
- spec/GITHUB_ACTIONS_EVENT_MAPPING.md
- spec/REPO_STRUCTURE.md

If files are not inside /spec, adjust paths accordingly.

---

## Implementation Rules

- Follow canonical event schema exactly as defined in agent_spec.json.
- Use workflow_run for CI lifecycle timing.
- Use check_suite/check_run for pass/fail gating when available.
- Build in phases (see AGENT_BLUEPRINT.md Build Order).
- Each phase must produce runnable code.
- Do not over-engineer V1.
- Optimize after correctness.
- Implement reconnect + replay buffer handling.
- Keep wallboard mode glanceable and minimal UI.
- Mobile mode must reduce draw calls and visible robots.

---

## Build Phases

Phase 1
- Create monorepo structure (apps/event-hub + apps/factory-ui)
- Implement webhook endpoint + signature verification
- Implement canonical normalization
- Implement WebSocket streaming
- Implement GET /state

Phase 2
- Greybox 6 factory zones
- Implement camera tour (wallboard mode)
- Spawn crates/modules based on events

Phase 3
- Add robot base rig system
- Implement role animation controllers
- Bind canonical events to robot reactions

Phase 4
- Implement KPI aggregation
- Add overlays per UI mode

Phase 5
- Add LOD, instancing, texture compression
- Add lighting modes (normal / incident / celebration)

---

## Acceptance Criteria

Wallboard:
- Runs continuously
- Updates within 2 seconds of webhook event
- Clearly shows CI failures and releases

Laptop:
- Click station to zoom
- Click module to see PR details

Mobile:
- Swipe stations
- Compact event feed

System:
- Signature verification enforced
- Replay buffer works
- Safe handling of unexpected payloads

---

## Coding Style

Backend:
- TypeScript strict mode
- Modular structure per REPO_STRUCTURE.md
- Small pure functions for normalization
- Unit test normalization + signature verification

Frontend:
- Modular zone classes
- RobotController abstraction
- Event-driven animation triggers
- No heavy state libraries required for V1

---

Begin by scaffolding the repository structure exactly as defined.
