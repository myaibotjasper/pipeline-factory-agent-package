import * as THREE from 'three';

export type StationId =
  | 'RECEIVING_DOCK'
  | 'BLUEPRINT_LOFT'
  | 'ASSEMBLY_LINE'
  | 'QA_GATE'
  | 'LAUNCH_BAY'
  | 'CONTROL_ROOM';

export type Station = {
  id: StationId;
  label: string;
  group: THREE.Group;
  anchor: THREE.Object3D;
};

function stationBlock(color: number) {
  const g = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.4, 7),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      metalness: 0.2,
      roughness: 0.8,
    })
  );
  base.position.y = 1.2;
  base.castShadow = false;
  base.receiveShadow = true;
  g.add(base);

  // conveyor
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.32, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x0b1024, metalness: 0.1, roughness: 0.9 })
  );
  belt.position.set(0, 0.18, -3.6);
  g.add(belt);

  // conveyor chevrons (pure greybox readability)
  const chevronMat = new THREE.MeshStandardMaterial({ color: 0x223b66, emissive: 0x223b66, emissiveIntensity: 0.25, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.25), chevronMat);
    c.position.set(-5.0 + i * 2.0, 0.35, -3.6);
    c.rotation.y = 0.35;
    g.add(c);
  }

  return g;
}

export class FactoryWorld {
  scene: THREE.Scene;
  stations: Station[] = [];
  stationById = new Map<StationId, Station>();
  stationMeshes: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const defs: Array<{ id: StationId; label: string; pos: THREE.Vector3; color: number }> = [
      { id: 'RECEIVING_DOCK', label: 'Receiving Dock', pos: new THREE.Vector3(-24, 0, -6), color: 0x4aa3ff },
      { id: 'BLUEPRINT_LOFT', label: 'Blueprint Loft', pos: new THREE.Vector3(-10, 0, 8), color: 0x8fff6a },
      { id: 'ASSEMBLY_LINE', label: 'Assembly Line', pos: new THREE.Vector3(6, 0, -4), color: 0xffd60a },
      { id: 'QA_GATE', label: 'QA Gate', pos: new THREE.Vector3(18, 0, 8), color: 0xff3b30 },
      { id: 'LAUNCH_BAY', label: 'Launch Bay', pos: new THREE.Vector3(30, 0, -6), color: 0x9b8cff },
      { id: 'CONTROL_ROOM', label: 'Control Room', pos: new THREE.Vector3(34, 0, 12), color: 0xffffff },
    ];

    for (const d of defs) {
      const group = stationBlock(d.color);
      group.position.copy(d.pos);
      group.userData.stationId = d.id;
      group.userData.clickable = true;

      // anchor for camera (visible marker)
      const anchor = new THREE.Object3D();
      anchor.position.set(d.pos.x, 8.5, d.pos.z + 14);
      anchor.userData.stationId = d.id;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 4.0, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a3a6a, emissive: 0x2a3a6a, emissiveIntensity: 0.2, roughness: 0.95 })
      );
      pole.position.set(0, -2.0, 0);
      anchor.add(pole);

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 14, 14),
        new THREE.MeshStandardMaterial({ color: d.color, emissive: d.color, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.6 })
      );
      bulb.position.set(0, 0.2, 0);
      anchor.add(bulb);

      this.scene.add(anchor);

      this.scene.add(group);

      const st: Station = { id: d.id, label: d.label, group, anchor };
      this.stations.push(st);
      this.stationById.set(d.id, st);
      this.stationMeshes.push(group);
    }

    // simple connecting lines between stations
    const lineMat = new THREE.LineBasicMaterial({ color: 0x223b66, transparent: true, opacity: 0.6 });
    const pts = defs.map((d) => new THREE.Vector3(d.pos.x, 0.05, d.pos.z));
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(lineGeo, lineMat);
    this.scene.add(line);
  }

  flashStation(id: StationId, ok: boolean) {
    const st = this.stationById.get(id);
    if (!st) return;
    st.group.traverse((o) => {
      const m = (o as any).material as THREE.MeshStandardMaterial | undefined;
      if (!m || !('emissiveIntensity' in m)) return;
      (m as any).emissiveIntensity = ok ? 0.9 : 1.1;
    });
    setTimeout(() => {
      st.group.traverse((o) => {
        const m = (o as any).material as THREE.MeshStandardMaterial | undefined;
        if (!m || !('emissiveIntensity' in m)) return;
        (m as any).emissiveIntensity = 0.25;
      });
    }, 500);
  }
}
