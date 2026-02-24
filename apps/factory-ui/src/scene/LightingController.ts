import * as THREE from 'three';

export type LightingMode = 'normal' | 'incident' | 'celebration';

/**
 * Small, centralized lighting preset switcher.
 * Intentionally simple: just tweaks existing lights and fog color.
 */
export class LightingController {
  private mode: LightingMode = 'normal';

  constructor(
    private opts: {
      scene: THREE.Scene;
      hemi: THREE.HemisphereLight;
      dir: THREE.DirectionalLight;
    }
  ) {}

  getMode() {
    return this.mode;
  }

  setMode(mode: LightingMode) {
    if (mode === this.mode) return;
    this.mode = mode;

    const { scene, hemi, dir } = this.opts;

    if (mode === 'normal') {
      hemi.color.setHex(0x9cc7ff);
      hemi.groundColor.setHex(0x0b1024);
      hemi.intensity = 1.0;

      dir.color.setHex(0xffffff);
      dir.intensity = 0.9;

      if (scene.fog && (scene.fog as any).isFog) {
        (scene.fog as THREE.Fog).color.setHex(0x070a12);
      }
      return;
    }

    if (mode === 'incident') {
      // warmer / alarming, but still readable
      hemi.color.setHex(0xffc1c1);
      hemi.groundColor.setHex(0x22050a);
      hemi.intensity = 1.15;

      dir.color.setHex(0xff3b30);
      dir.intensity = 1.05;

      if (scene.fog && (scene.fog as any).isFog) {
        (scene.fog as THREE.Fog).color.setHex(0x12060a);
      }
      return;
    }

    // celebration
    hemi.color.setHex(0x9b8cff);
    hemi.groundColor.setHex(0x071022);
    hemi.intensity = 1.05;

    dir.color.setHex(0x7bffb2);
    dir.intensity = 0.95;

    if (scene.fog && (scene.fog as any).isFog) {
      (scene.fog as THREE.Fog).color.setHex(0x070a12);
    }
  }
}
