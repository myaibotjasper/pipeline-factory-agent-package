import * as THREE from 'three';

export type RobotHeadVariant = 'round_led' | 'visor_led' | 'square_led' | 'mono_eye' | 'antenna' | 'boss_crown_led';
export type RobotPropVariant = 'tablet_scanner' | 'holo_projector' | 'welder_tool' | 'scanner_beam' | 'launch_lever' | 'pointer_baton';

export type RobotVariant = {
  head: RobotHeadVariant;
  prop: RobotPropVariant;
};

export type RobotRigParts = {
  root: THREE.Group;
  body: THREE.Mesh;
  headPivot: THREE.Object3D;
  head: THREE.Object3D;
  eye: THREE.Mesh;
  armLPivot: THREE.Object3D;
  armRPivot: THREE.Object3D;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  propPivot: THREE.Object3D;
  prop: THREE.Object3D;
};

function stdMat(color: number, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    metalness: 0.25,
    roughness: 0.75,
  });
}

function buildHead(v: RobotHeadVariant, eyeMat: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.name = 'head';

  const shellColor = 0xcad6ff;
  const shell =
    v === 'square_led'
      ? new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.6), stdMat(shellColor))
      : new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 14), stdMat(shellColor));
  shell.castShadow = false;
  shell.receiveShadow = true;
  shell.position.y = 0.9;
  g.add(shell);

  // face plate
  const face = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.75, 0.08), stdMat(0x0b1024, 0x0b1024, 0.15));
  face.position.set(0, 0.95, 0.88);
  g.add(face);

  // eye/visor
  let eyeGeo: THREE.BufferGeometry;
  if (v === 'mono_eye') eyeGeo = new THREE.SphereGeometry(0.18, 10, 10);
  else if (v === 'visor_led') eyeGeo = new THREE.BoxGeometry(0.9, 0.18, 0.18);
  else eyeGeo = new THREE.BoxGeometry(0.55, 0.22, 0.18);

  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.name = 'eye';
  eye.position.set(0, 0.95, 0.98);
  g.add(eye);

  if (v === 'antenna' || v === 'boss_crown_led') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), stdMat(0x2a3a6a));
    pole.position.set(0, 1.85, 0.1);
    g.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), stdMat(0xffd60a, 0xffd60a, 0.6));
    bulb.position.set(0, 2.25, 0.1);
    g.add(bulb);
  }

  if (v === 'boss_crown_led') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.35, 10, 1, true), stdMat(0xffd60a, 0xffd60a, 0.2));
    crown.position.set(0, 1.7, 0.1);
    g.add(crown);
  }

  return { group: g, eye };
}

function buildProp(v: RobotPropVariant, accentMat: THREE.MeshStandardMaterial) {
  const g = new THREE.Group();
  g.name = 'prop';

  if (v === 'tablet_scanner') {
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.6, 0.08), stdMat(0x0b1024, 0x4aa3ff, 0.45));
    tab.position.set(0.7, 0.9, 0.2);
    g.add(tab);
  } else if (v === 'holo_projector') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 10), stdMat(0x2a3a6a));
    base.position.set(0.7, 0.7, 0.2);
    g.add(base);
    const holo = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 12, 1, true), accentMat);
    holo.position.set(0.7, 1.2, 0.2);
    holo.rotation.x = Math.PI;
    g.add(holo);
  } else if (v === 'welder_tool') {
    const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10), stdMat(0x6b7aa8));
    tool.position.set(0.8, 0.85, 0.15);
    tool.rotation.z = Math.PI / 2;
    g.add(tool);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), stdMat(0xff9500, 0xff9500, 0.55));
    tip.position.set(1.2, 0.85, 0.15);
    g.add(tip);
  } else if (v === 'scanner_beam') {
    const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 10), stdMat(0x6b7aa8));
    wand.position.set(0.8, 0.9, 0.15);
    wand.rotation.z = Math.PI / 2;
    g.add(wand);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.12, 1.0, 12, 1, true), accentMat);
    beam.position.set(1.35, 0.9, 0.15);
    beam.rotation.z = Math.PI / 2;
    g.add(beam);
  } else if (v === 'launch_lever') {
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), stdMat(0x6b7aa8));
    lever.position.set(0.8, 0.95, 0.15);
    lever.rotation.z = 0.35;
    g.add(lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), stdMat(0xff3b30, 0xff3b30, 0.35));
    knob.position.set(0.98, 1.32, 0.15);
    g.add(knob);
  } else if (v === 'pointer_baton') {
    const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 10), stdMat(0xffffff, 0x9b8cff, 0.25));
    baton.position.set(0.85, 1.0, 0.2);
    baton.rotation.z = -0.4;
    g.add(baton);
  }

  return g;
}

export function createRobotBaseRigV1(opts: {
  id: string;
  variant: RobotVariant;
  accentColor?: number;
}): RobotRigParts {
  const { id, variant } = opts;

  const root = new THREE.Group();
  root.name = `robot:${id}`;
  root.userData.kind = 'robot';
  root.userData.robotId = id;

  const accent = opts.accentColor ?? 0x4aa3ff;
  const eyeMat = stdMat(0xffffff, accent, 0.85);
  const accentMat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.55,
    metalness: 0.05,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 1.25, 6, 12), stdMat(0xb6c6ff));
  body.name = 'body';
  body.position.y = 1.35;
  body.castShadow = false;
  body.receiveShadow = true;
  root.add(body);

  // chest panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.07), stdMat(0x0b1024, accent, 0.3));
  panel.position.set(0, 1.35, 0.92);
  root.add(panel);

  const headPivot = new THREE.Object3D();
  headPivot.name = 'head_pivot';
  headPivot.position.set(0, 2.1, 0);
  root.add(headPivot);

  const builtHead = buildHead(variant.head, eyeMat);
  headPivot.add(builtHead.group);

  // arms
  const armLPivot = new THREE.Object3D();
  armLPivot.name = 'armL_pivot';
  armLPivot.position.set(-1.05, 1.7, 0);
  root.add(armLPivot);

  const armRPivot = new THREE.Object3D();
  armRPivot.name = 'armR_pivot';
  armRPivot.position.set(1.05, 1.7, 0);
  root.add(armRPivot);

  const armGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.25, 10);
  const armMat = stdMat(0x6b7aa8);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.name = 'armL';
  armL.position.y = -0.6;
  armLPivot.add(armL);

  const armR = new THREE.Mesh(armGeo, armMat);
  armR.name = 'armR';
  armR.position.y = -0.6;
  armRPivot.add(armR);

  const propPivot = new THREE.Object3D();
  propPivot.name = 'prop_pivot';
  propPivot.position.set(0, 0, 0);
  armRPivot.add(propPivot);

  const prop = buildProp(variant.prop, accentMat);
  propPivot.add(prop);

  // feet
  const footMat = stdMat(0x2a3a6a);
  const footL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.75), footMat);
  footL.name = 'footL';
  footL.position.set(-0.45, 0.15, 0);
  root.add(footL);
  const footR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.75), footMat);
  footR.name = 'footR';
  footR.position.set(0.45, 0.15, 0);
  root.add(footR);

  return {
    root,
    body,
    headPivot,
    head: builtHead.group,
    eye: builtHead.eye,
    armLPivot,
    armRPivot,
    armL,
    armR,
    propPivot,
    prop,
  };
}
