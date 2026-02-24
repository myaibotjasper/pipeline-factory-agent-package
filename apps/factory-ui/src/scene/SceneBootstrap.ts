import * as THREE from 'three';
import { FactoryWorld, type StationId } from './FactoryWorld';
import { CameraRig } from './controls/CameraRig';
import { ModuleLayer } from './ModuleLayer';
import { FlowLayer } from './FlowLayer';
import type { UIMode } from '../ui/modes/mode';
import { RobotController } from './robots/RobotController';
import { ROBOT_SPECS } from './robots/RobotSpecs';
import { LightingController, type LightingMode } from './LightingController';

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

  const lighting = new LightingController({ scene, hemi, dir });

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

  // --- Dynamic degradation ladder (minimal) ---
  // 0: full, 1: reduce particles, 2: disable shadows/postprocessing (if any), 3: reduce robots
  let qualityLevel = 0;
  const baseRobotCount = robots.getActiveLimit();

  function applyQuality() {
    if (qualityLevel <= 0) {
      flow.setQuality({ particleScale: 1.0, maxItems: 140 });
      // no postprocessing in this project, but ensure renderer stays lean
      renderer.shadowMap.enabled = false;
      robots.setActiveLimit(baseRobotCount);
      return;
    }

    if (qualityLevel === 1) {
      flow.setQuality({ particleScale: 0.55, maxItems: 90 });
      renderer.shadowMap.enabled = false;
      robots.setActiveLimit(baseRobotCount);
      return;
    }

    if (qualityLevel === 2) {
      flow.setQuality({ particleScale: 0.35, maxItems: 70 });
      renderer.shadowMap.enabled = false;
      // (postprocessing: none)
      robots.setActiveLimit(baseRobotCount);
      return;
    }

    flow.setQuality({ particleScale: 0.25, maxItems: 55 });
    renderer.shadowMap.enabled = false;
    robots.setActiveLimit(Math.max(4, Math.floor(baseRobotCount * 0.6)));
  }
  applyQuality();

  // basic perf sampling (EMA of dt)
  let t0 = performance.now();
  let emaDt = 1 / 60;
  let slowFor = 0;
  let fastFor = 0;

  function tick() {
    const t = performance.now();
    const dt = (t - t0) / 1000;
    t0 = t;

    // clamp to avoid tab-sleep spikes causing instant degradation
    const dtClamped = Math.min(0.2, Math.max(0, dt));
    emaDt = emaDt * 0.92 + dtClamped * 0.08;

    // thresholds: degrade if ~<30fps sustained, recover if ~>45fps sustained
    if (emaDt > 1 / 30) {
      slowFor += dtClamped;
      fastFor = 0;
    } else if (emaDt < 1 / 45) {
      fastFor += dtClamped;
      slowFor = 0;
    }

    if (slowFor > 2.0 && qualityLevel < 3) {
      qualityLevel += 1;
      slowFor = 0;
      fastFor = 0;
      applyQuality();
    }

    if (fastFor > 6.0 && qualityLevel > 0) {
      qualityLevel -= 1;
      slowFor = 0;
      fastFor = 0;
      applyQuality();
    }

    rig.tick(dtClamped);
    flow.tick(dtClamped);
    robots.tick(dtClamped);
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
    lighting,
    setLightingMode(m: LightingMode) {
      lighting.setMode(m);
    },
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
