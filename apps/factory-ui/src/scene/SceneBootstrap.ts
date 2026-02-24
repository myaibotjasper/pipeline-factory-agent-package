import * as THREE from 'three';
import { FactoryWorld, type StationId } from './FactoryWorld';
import { CameraRig } from './controls/CameraRig';
import { ModuleLayer } from './ModuleLayer';
import { FlowLayer } from './FlowLayer';
import type { UIMode } from '../ui/modes/mode';
import { RobotController } from './robots/RobotController';
import { ROBOT_SPECS } from './robots/RobotSpecs';

export function bootScene(container: HTMLElement, mode: UIMode) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor('#070A12');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070a12, 10, 70);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 250);
  camera.position.set(0, 10, 22);

  const rig = new CameraRig(camera);

  const hemi = new THREE.HemisphereLight(0x9cc7ff, 0x0b1024, 1.0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 18, 10);
  scene.add(dir);

  const floorGeo = new THREE.PlaneGeometry(120, 70);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x071022, metalness: 0.2, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const world = new FactoryWorld(scene);

  const flow = new FlowLayer(world.stationById);
  scene.add(flow.group);

  const maxVisibleRobots = mode === 'mobile' ? 12 : mode === 'laptop' ? 25 : 40;
  const robots = new RobotController({ stationById: world.stationById, mode, maxVisibleRobots, specs: ROBOT_SPECS });
  scene.add(robots.group);

  // modules live near blueprint loft
  const blueprint = world.stationById.get('BLUEPRINT_LOFT');
  const moduleLayer = new ModuleLayer(
    blueprint ? new THREE.Vector3(blueprint.group.position.x, 0, blueprint.group.position.z + 4) : new THREE.Vector3(0, 0, 0)
  );
  scene.add(moduleLayer.group);

  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function pickStation(ev: PointerEvent): StationId | null {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    ray.setFromCamera(mouse, camera);

    const hits = ray.intersectObjects(world.stationMeshes, true);
    const hit = hits.find((h) => {
      const o = h.object;
      return (o.parent as any)?.userData?.stationId || (o as any).userData?.stationId;
    });
    if (!hit) return null;
    const stId = (hit.object.parent as any)?.userData?.stationId || (hit.object as any).userData?.stationId;
    return (stId as StationId) || null;
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

    rig.tick(dt);
    flow.tick(dt);
    robots.tick(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    camera,
    rig,
    world,
    moduleLayer,
    robots,
    onPointer(ev: PointerEvent) {
      return pickStation(ev);
    },
    pickModule(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
      ray.setFromCamera(mouse, camera);
      return moduleLayer.pick(ray);
    },
    flashStation(id: StationId, ok: boolean) {
      world.flashStation(id, ok);
    },
    flow,
  };
}
