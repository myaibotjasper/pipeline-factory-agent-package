import * as THREE from 'three';
import type { StationId } from './FactoryWorld';

type Mod = {
  key: string;
  title?: string;
  url?: string;
  status: 'info' | 'success' | 'failure' | 'warning';
  zone?: string;
  updated_ts: number;
};

function colorForStatus(s: Mod['status']) {
  if (s === 'success') return 0x7bffb2;
  if (s === 'failure') return 0xff7b7b;
  if (s === 'warning') return 0xffd60a;
  return 0x8ab4ff;
}

export class ModuleLayer {
  group = new THREE.Group();
  meshes = new Map<string, THREE.Mesh>();

  constructor(private anchorPos: THREE.Vector3) {
    this.group.position.copy(anchorPos);
  }

  upsertMany(mods: Mod[]) {
    const keep = new Set(mods.map((m) => m.key));
    for (const [k, mesh] of this.meshes.entries()) {
      if (!keep.has(k)) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as any)?.dispose?.();
        this.meshes.delete(k);
      }
    }

    const sorted = [...mods].sort((a, b) => b.updated_ts - a.updated_ts).slice(0, 24);
    sorted.forEach((m, idx) => this.upsert(m, idx));
  }

  private upsert(m: Mod, idx: number) {
    const existing = this.meshes.get(m.key);
    const c = colorForStatus(m.status);

    const mesh =
      existing ||
      new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 16, 16),
        new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, metalness: 0.25, roughness: 0.55 })
      );

    const row = Math.floor(idx / 6);
    const col = idx % 6;
    mesh.position.set(-6 + col * 2.4, 1.6 + row * 1.4, 0);

    (mesh.material as THREE.MeshStandardMaterial).color.setHex(c);
    (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(c);

    mesh.userData.moduleKey = m.key;
    mesh.userData.title = m.title;
    mesh.userData.url = m.url;
    mesh.userData.status = m.status;
    mesh.userData.zone = (m.zone as StationId | undefined) ?? undefined;

    if (!existing) {
      this.group.add(mesh);
      this.meshes.set(m.key, mesh);
    }
  }

  pick(ray: THREE.Raycaster): string | null {
    const hits = ray.intersectObjects([...this.meshes.values()], true);
    const h = hits[0];
    if (!h) return null;
    return (h.object as any).userData?.moduleKey || null;
  }
}
