import * as THREE from 'three';
import type { StationId, Station } from './FactoryWorld';

type ItemKind = 'crate' | 'module' | 'rocket' | 'spark';

type FlowItem = {
  id: string;
  kind: ItemKind;
  mesh: THREE.Object3D;
  path: THREE.Vector3[];
  duration: number;
  t: number;
  removeAfter?: number; // seconds
};

function lerpPath(points: THREE.Vector3[], u01: number, out = new THREE.Vector3()) {
  if (points.length === 0) return out.set(0, 0, 0);
  if (points.length === 1) return out.copy(points[0]);

  const segs = points.length - 1;
  const x = THREE.MathUtils.clamp(u01, 0, 1) * segs;
  const i = Math.min(segs - 1, Math.floor(x));
  const f = x - i;
  return out.copy(points[i]).lerp(points[i + 1], f);
}

export class FlowLayer {
  group = new THREE.Group();
  private items: FlowItem[] = [];
  private tmp = new THREE.Vector3();

  constructor(private stationById: Map<StationId, Station>) {}

  tick(dt: number) {
    for (const it of this.items) {
      it.t += dt;

      if (it.duration > 0) {
        const u = it.t / it.duration;
        lerpPath(it.path, u, this.tmp);
        it.mesh.position.copy(this.tmp);

        // face movement direction (helps readability)
        if (it.path.length >= 2) {
          const u2 = Math.min(1, u + 0.02);
          const p2 = lerpPath(it.path, u2, new THREE.Vector3());
          it.mesh.lookAt(p2);
        }
      }

      if (typeof it.removeAfter === 'number' && it.t >= it.removeAfter) {
        it.t = it.duration + 999; // mark for removal
      }
    }

    // cleanup
    const alive: FlowItem[] = [];
    for (const it of this.items) {
      if (it.duration > 0 && it.t <= it.duration) {
        alive.push(it);
        continue;
      }
      if (typeof it.removeAfter === 'number' && it.t <= it.removeAfter) {
        alive.push(it);
        continue;
      }
      this.group.remove(it.mesh);
      it.mesh.traverse((o) => {
        const m = (o as any).material;
        const g = (o as any).geometry;
        if (g?.dispose) g.dispose();
        if (m?.dispose) m.dispose();
      });
    }
    this.items = alive;
  }

  private stationPoint(id: StationId, dx: number, dz: number, y = 0.6) {
    const st = this.stationById.get(id);
    if (!st) return new THREE.Vector3();
    return new THREE.Vector3(st.group.position.x + dx, y, st.group.position.z + dz);
  }

  spawnCrateBurst(from: StationId, to: StationId, n = 5) {
    for (let i = 0; i < n; i++) {
      const hue = 0x4aa3ff;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.7, 0.7),
        new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.8 })
      );

      // little random start scatter
      mesh.position.copy(this.stationPoint(from, -2 + Math.random() * 1.5, -2 + Math.random() * 1.5, 0.55));
      this.group.add(mesh);

      const p0 = mesh.position.clone();
      const mid = this.stationPoint(
        from,
        (this.stationById.get(to)!.group.position.x - this.stationById.get(from)!.group.position.x) * 0.25,
        0,
        0.55
      );
      const p1 = mid;
      const p2 = this.stationPoint(to, -2 + Math.random() * 1.5, -2 + Math.random() * 1.5, 0.55);

      this.items.push({
        id: `crate:${Date.now()}:${i}`,
        kind: 'crate',
        mesh,
        path: [p0, p1, p2],
        duration: 2.2 + Math.random() * 0.6,
        t: 0,
      });
    }
  }

  routeModule(from: StationId, to: StationId, status: 'info' | 'success' | 'failure' | 'warning') {
    const c = status === 'success' ? 0x7bffb2 : status === 'failure' ? 0xff5252 : status === 'warning' ? 0xffd60a : 0x8ab4ff;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 16),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, metalness: 0.25, roughness: 0.55 })
    );

    const p0 = this.stationPoint(from, 0, 1.8, 1.4);
    const p2 = this.stationPoint(to, 0, 1.8, 1.4);
    const p1 = new THREE.Vector3((p0.x + p2.x) / 2, 2.6, (p0.z + p2.z) / 2);

    mesh.position.copy(p0);
    this.group.add(mesh);

    this.items.push({
      id: `module:${Date.now()}`,
      kind: 'module',
      mesh,
      path: [p0, p1, p2],
      duration: 2.4,
      t: 0,
    });
  }

  qaResult(ok: boolean) {
    // simple visual: short-lived sparks near QA gate
    const qa = this.stationById.get('QA_GATE');
    if (!qa) return;
    const base = new THREE.Vector3(qa.group.position.x + 1.5, 1.1, qa.group.position.z - 2.7);

    const color = ok ? 0x7bffb2 : 0xff3b30;
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, 0.15),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 })
      );
      s.position.copy(base).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, Math.random() * 0.8, (Math.random() - 0.5) * 1.2));
      this.group.add(s);
      const p0 = s.position.clone();
      const p1 = p0.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.0, 1.2 + Math.random() * 1.8, (Math.random() - 0.5) * 2.0));
      this.items.push({ id: `spark:${Date.now()}:${i}`, kind: 'spark', mesh: s, path: [p0, p1], duration: 0.55, t: 0 });
    }
  }

  launchRocket() {
    const bay = this.stationById.get('LAUNCH_BAY');
    if (!bay) return;

    const rocket = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9b8cff, emissiveIntensity: 0.25, metalness: 0.2, roughness: 0.7 })
    );
    body.position.y = 1.1;
    rocket.add(body);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x9b8cff, emissive: 0x9b8cff, emissiveIntensity: 0.3, metalness: 0.2, roughness: 0.6 })
    );
    nose.position.y = 2.3;
    rocket.add(nose);

    const p0 = new THREE.Vector3(bay.group.position.x + 2.8, 0.0, bay.group.position.z - 3.4);
    const p1 = p0.clone().add(new THREE.Vector3(0, 18, 0));

    rocket.position.copy(p0);
    this.group.add(rocket);

    this.items.push({ id: `rocket:${Date.now()}`, kind: 'rocket', mesh: rocket, path: [p0, p1], duration: 2.8, t: 0 });
  }
}
