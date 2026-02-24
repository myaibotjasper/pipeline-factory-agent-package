import * as THREE from 'three';

export type CameraStop = {
  pos: THREE.Vector3;
  lookAt: THREE.Vector3;
  seconds: number;
};

export class CameraRig {
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private curLook = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {
    this.targetPos.copy(camera.position);
    this.targetLook.set(0, 1.2, 0);
    this.curLook.copy(this.targetLook);
  }

  snapTo(pos: THREE.Vector3, lookAt: THREE.Vector3) {
    this.camera.position.copy(pos);
    this.targetPos.copy(pos);
    this.curLook.copy(lookAt);
    this.targetLook.copy(lookAt);
    this.camera.lookAt(this.curLook);
  }

  setTarget(pos: THREE.Vector3, lookAt: THREE.Vector3) {
    this.targetPos.copy(pos);
    this.targetLook.copy(lookAt);
  }

  tick(dt: number) {
    const k = 1 - Math.pow(0.001, dt); // smooth
    this.camera.position.lerp(this.targetPos, k);
    this.curLook.lerp(this.targetLook, k);
    this.camera.lookAt(this.curLook);
  }
}
