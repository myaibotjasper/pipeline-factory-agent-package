import * as THREE from 'three';

export function bootScene(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor('#070A12');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070a12, 10, 60);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 10, 22);

  const hemi = new THREE.HemisphereLight(0x9cc7ff, 0x0b1024, 1.0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 18, 10);
  scene.add(dir);

  const floorGeo = new THREE.PlaneGeometry(80, 50);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x071022, metalness: 0.2, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // Neon-ish station blocks (placeholder for full models)
  const stations = [
    { id: 'RECEIVING_DOCK', x: -22, z: -6, c: 0x4aa3ff },
    { id: 'BLUEPRINT_LOFT', x: -10, z: 8, c: 0x8fff6a },
    { id: 'ASSEMBLY_LINE', x: 4, z: -4, c: 0xffd60a },
    { id: 'QA_GATE', x: 16, z: 8, c: 0xff3b30 },
    { id: 'LAUNCH_BAY', x: 26, z: -6, c: 0x9b8cff },
  ];

  const stationMeshes = new Map<string, THREE.Mesh>();
  for (const s of stations) {
    const geo = new THREE.BoxGeometry(8, 2.2, 6);
    const mat = new THREE.MeshStandardMaterial({ color: s.c, emissive: s.c, emissiveIntensity: 0.35, metalness: 0.25, roughness: 0.75 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, 1.1, s.z);
    scene.add(m);
    stationMeshes.set(s.id, m);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  let t0 = performance.now();
  function tick() {
    const t = performance.now();
    const dt = (t - t0) / 1000;
    t0 = t;

    // slow camera drift (wallboard feel)
    camera.position.x = Math.sin(t * 0.00018) * 2.2;
    camera.lookAt(0, 1.2, 0);

    // subtle station pulse
    for (const m of stationMeshes.values()) {
      m.scale.y = 1 + Math.sin(t * 0.002 + m.position.x) * 0.02;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    stationMeshes,
    flashStation(id: string, ok: boolean) {
      const m = stationMeshes.get(id);
      if (!m) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = ok ? 0.9 : 1.1;
      setTimeout(() => {
        mat.emissiveIntensity = 0.35;
      }, 500);
    },
  };
}
