import * as THREE from 'three';
import type { CanonicalEvent } from '../../net/EventStream';
import type { Station, StationId } from '../FactoryWorld';
import { createRobotBaseRigV1, type RobotRigParts, type RobotVariant } from './RobotRig';

export type RobotAnimState = 'idle' | 'work' | 'success' | 'failure';

export type RobotSpec = {
  id: string;
  role: string;
  home_zone: StationId;
  count?: number;
  rig: 'robot_base_rig_v1' | string;
  variant: RobotVariant;
  clips: { idle: string; work: string; success: string; failure: string };
};

type RobotInstance = {
  spec: RobotSpec;
  parts: RobotRigParts;
  state: RobotAnimState;
  stateT: number;
  stateHold: number; // seconds to hold before returning to idle (0=loop)
  phase: number;
  basePos: THREE.Vector3;
  baseRotY: number;
  accent: number;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export class RobotController {
  group = new THREE.Group();

  private robots: RobotInstance[] = [];
  private stationById: Map<StationId, Station>;

  constructor(opts: {
    stationById: Map<StationId, Station>;
    mode: 'wallboard' | 'laptop' | 'mobile';
    maxVisibleRobots: number;
    specs: RobotSpec[];
  }) {
    this.stationById = opts.stationById;
    this.group.name = 'RobotController';

    // performance budget: hard cap
    const expanded: RobotSpec[] = [];
    for (const s of opts.specs) {
      const n = Math.max(1, s.count ?? 1);
      for (let i = 0; i < n; i++) {
        expanded.push({ ...s, id: n > 1 ? `${s.id}_${i + 1}` : s.id, count: 1 });
      }
    }
    const capped = expanded.slice(0, Math.max(0, opts.maxVisibleRobots));

    // spawn robots near their home station
    const homeCounts = new Map<StationId, number>();
    for (const s of capped) {
      const k = s.home_zone;
      homeCounts.set(k, (homeCounts.get(k) ?? 0) + 1);
    }
    const homeIdx = new Map<StationId, number>();

    for (const spec of capped) {
      const st = this.stationById.get(spec.home_zone);
      if (!st) continue;

      const idx = homeIdx.get(spec.home_zone) ?? 0;
      homeIdx.set(spec.home_zone, idx + 1);
      const total = homeCounts.get(spec.home_zone) ?? 1;

      // compact layout in a shallow arc in front of the station
      const radius = total <= 1 ? 4.0 : 4.6;
      const spread = total <= 1 ? 0 : Math.min(1.3, 0.25 * total);
      const a = total <= 1 ? 0 : (idx / Math.max(1, total - 1) - 0.5) * spread;

      const pos = new THREE.Vector3(st.group.position.x + Math.sin(a) * radius, 0, st.group.position.z + 5.2 + Math.cos(a) * 0.4);
      const rotY = Math.PI + a * 0.35;

      const accent = this.accentForZone(spec.home_zone);
      const parts = createRobotBaseRigV1({ id: spec.id, variant: spec.variant, accentColor: accent });
      parts.root.position.copy(pos);
      parts.root.rotation.y = rotY;

      // name parts for debug/readability
      parts.root.traverse((o) => {
        if (!o.name) return;
        o.userData.part = o.name;
        o.userData.robotId = spec.id;
      });

      this.group.add(parts.root);

      this.robots.push({
        spec,
        parts,
        state: 'idle',
        stateT: 0,
        stateHold: 0,
        phase: Math.random() * Math.PI * 2,
        basePos: pos,
        baseRotY: rotY,
        accent,
      });
    }
  }

  private accentForZone(z: StationId): number {
    switch (z) {
      case 'RECEIVING_DOCK':
        return 0x4aa3ff;
      case 'BLUEPRINT_LOFT':
        return 0x8fff6a;
      case 'ASSEMBLY_LINE':
        return 0xffd60a;
      case 'QA_GATE':
        return 0xff3b30;
      case 'LAUNCH_BAY':
        return 0x9b8cff;
      case 'CONTROL_ROOM':
        return 0xffffff;
      default:
        return 0x4aa3ff;
    }
  }

  tick(dt: number) {
    for (const r of this.robots) {
      r.stateT += dt;
      const t = r.stateT;

      // timed reactions fall back to idle
      if (r.stateHold > 0 && t >= r.stateHold) {
        this.setRobotState(r, 'idle', 0);
      }

      // baseline idle bob
      const idleBob = Math.sin(t * 1.8 + r.phase) * 0.06;
      r.parts.root.position.y = idleBob;

      // keep planted
      r.parts.root.position.x = r.basePos.x;
      r.parts.root.position.z = r.basePos.z;
      r.parts.root.rotation.y = r.baseRotY;

      // blink/eye pulse
      const blink = (Math.sin(t * 2.2 + r.phase * 2.0) + 1) * 0.5;
      const eye = r.parts.eye.material as THREE.MeshStandardMaterial;
      eye.emissiveIntensity = 0.55 + 0.35 * blink;

      // apply state animation
      if (r.state === 'idle') {
        r.parts.headPivot.rotation.y = Math.sin(t * 0.8 + r.phase) * 0.2;
        r.parts.headPivot.rotation.x = Math.sin(t * 0.6 + r.phase) * 0.08;
        r.parts.armLPivot.rotation.z = Math.sin(t * 0.9 + r.phase) * 0.2 + 0.25;
        r.parts.armRPivot.rotation.z = -Math.sin(t * 0.9 + r.phase) * 0.18 - 0.15;
        r.parts.propPivot.rotation.y = Math.sin(t * 0.7 + r.phase) * 0.25;
      }

      if (r.state === 'work') {
        const w = Math.sin(t * 8.5 + r.phase);
        r.parts.headPivot.rotation.x = -0.12 + Math.sin(t * 3.2 + r.phase) * 0.06;
        r.parts.armLPivot.rotation.z = 0.8 + w * 0.25;
        r.parts.armRPivot.rotation.z = -0.9 + w * -0.25;
        r.parts.propPivot.rotation.x = 0.35 + Math.sin(t * 12.0 + r.phase) * 0.15;
        // tiny shuffle forward/back
        r.parts.root.position.y += Math.abs(w) * 0.03;
      }

      if (r.state === 'success') {
        const p = clamp01(t / Math.max(0.0001, r.stateHold));
        const hop = Math.sin(p * Math.PI) * 0.22;
        r.parts.root.position.y += hop;
        r.parts.armLPivot.rotation.z = 0.2 + Math.sin(t * 6.0 + r.phase) * 0.9;
        r.parts.armRPivot.rotation.z = -0.2 - Math.sin(t * 6.0 + r.phase) * 0.9;
        r.parts.headPivot.rotation.y = Math.sin(t * 4.0 + r.phase) * 0.35;
        eye.emissiveIntensity = 1.25;
      }

      if (r.state === 'failure') {
        const sway = Math.sin(t * 3.2 + r.phase) * 0.25;
        r.parts.root.rotation.z = sway * 0.08;
        r.parts.headPivot.rotation.y = sway * 0.4;
        r.parts.armLPivot.rotation.z = 1.1;
        r.parts.armRPivot.rotation.z = -1.1;
        eye.emissiveIntensity = 0.35;
      } else {
        r.parts.root.rotation.z = 0;
      }
    }
  }

  private setRobotState(r: RobotInstance, state: RobotAnimState, holdSeconds: number) {
    r.state = state;
    r.stateT = 0;
    r.stateHold = holdSeconds;
  }

  private react(home: StationId, state: RobotAnimState, holdSeconds: number) {
    for (const r of this.robots) {
      if (r.spec.home_zone !== home) continue;
      this.setRobotState(r, state, holdSeconds);
    }
  }

  /**
   * Bind canonical events to robot reactions (per agent_spec.json zone bindings).
   * We keep this intentionally simple: short one-shots for success/failure, brief work bursts otherwise.
   */
  onEvent(ev: CanonicalEvent) {
    switch (ev.type) {
      case 'CODE_PUSHED':
        this.react('RECEIVING_DOCK', 'work', 1.8);
        this.react('ASSEMBLY_LINE', 'work', 2.4);
        break;
      case 'PR_OPENED':
        this.react('RECEIVING_DOCK', 'work', 1.8);
        this.react('BLUEPRINT_LOFT', 'work', 2.2);
        break;
      case 'PR_UPDATED':
        this.react('BLUEPRINT_LOFT', 'work', 1.6);
        break;
      case 'CI_STARTED':
        this.react('ASSEMBLY_LINE', 'work', 2.6);
        this.react('QA_GATE', 'work', 3.0);
        this.react('CONTROL_ROOM', 'work', 1.2);
        break;
      case 'CI_COMPLETED':
        if (ev.status === 'success') {
          this.react('QA_GATE', 'success', 1.7);
          this.react('CONTROL_ROOM', 'success', 1.2);
        } else if (ev.status === 'failure') {
          this.react('QA_GATE', 'failure', 2.0);
          this.react('CONTROL_ROOM', 'failure', 2.4);
        }
        break;
      case 'RELEASE_PUBLISHED':
        this.react('LAUNCH_BAY', 'work', 1.8);
        // then celebratory pose
        setTimeout(() => this.react('LAUNCH_BAY', 'success', 1.8), 900);
        this.react('CONTROL_ROOM', 'success', 1.8);
        break;
      case 'HEARTBEAT':
        // gentle reminder that the factory is alive
        this.react('CONTROL_ROOM', 'idle', 0);
        break;
      default:
        break;
    }

    // if the event includes a station hint, also pulse that zone's robots
    if (ev.station_hint) {
      const st = ev.station_hint as StationId;
      if (ev.status === 'failure') this.react(st, 'failure', 1.6);
      else if (ev.status === 'success') this.react(st, 'success', 1.2);
      else this.react(st, 'work', 1.2);
    }
  }
}
