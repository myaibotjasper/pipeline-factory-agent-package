import * as THREE from 'three';
import type { StationId } from '../../scene/FactoryWorld';
import { CameraRig } from '../../scene/controls/CameraRig';

export class WallboardTour {
  private idx = 0;
  private t = 0;

  constructor(
    private rig: CameraRig,
    private stops: Array<{ id: StationId; pos: THREE.Vector3; lookAt: THREE.Vector3; seconds: number }>
  ) {
    if (this.stops.length) {
      const s = this.stops[0];
      this.rig.snapTo(s.pos, s.lookAt);
    }
  }

  tick(dt: number) {
    if (!this.stops.length) return;
    this.t += dt;
    const cur = this.stops[this.idx];
    if (this.t >= cur.seconds) {
      this.t = 0;
      this.idx = (this.idx + 1) % this.stops.length;
      const next = this.stops[this.idx];
      this.rig.setTarget(next.pos, next.lookAt);
    }
  }
}
