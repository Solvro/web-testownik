import { Quaternion, Vector3 } from "three";
import type { Camera, Mesh, Object3D } from "three";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

import { smoothstep } from "./utils";

/**
 * Where each live screen sits and how big it is — the one place that owns it.
 *
 * The live UI is a `CSS3DObject` parented to the display mesh itself, so it
 * inherits the hinge rotation, the model yaw and the camera perspective. An
 * earlier version projected four corners through the camera by hand and could
 * never be made stable — do not go back to a flat overlay.
 *
 * The numbers are baked from `public/models/device-stack.glb`. They used to be
 * re-derived on every load from each display's raw vertices, normals and UVs
 * (the MacBook glass is tilted 20° inside its own frame and Apple poses every
 * device differently, so no bounding box gives the plane). The GLB is a
 * deterministic build artefact, so that solve now runs once, offline;
 * `screens.test.ts` re-measures the display meshes in the GLB and fails if
 * these placements stop matching them. The solver they were baked from is
 * `display-plane.ts` as of commit `d9589472`; see `public/models/README.md`.
 */

export interface ScreenPlacement {
  /** Logical CSS size of the DOM host; the height follows the mesh aspect. */
  width: number;
  height: number;
  /** CSS3DObject transform in the display mesh's local space. */
  position: readonly [number, number, number];
  quaternion: readonly [number, number, number, number];
  /** Scene units per CSS pixel. */
  scale: number;
}

export const SCREEN_PLACEMENT = {
  laptop: {
    width: 940,
    height: 611,
    position: [
      0.000_040_054_619_834_234_85, 10.556_873_221_076_88,
      -15.138_089_128_634_508,
    ],
    // -20° about X: the panel's tilt inside the lid assembly.
    quaternion: [
      -0.173_648_941_135_467_22, -4.412_654_573_924_799_5e-11,
      -7.780_735_851_839_922e-12, 0.984_807_618_391_801,
    ],
    scale: 0.032_089_829_952_158_824,
  },
  tablet: {
    width: 720,
    height: 541,
    position: [
      -13.223_078_481_278_604, 10.883_718_913_483_037,
      -0.000_012_523_282_369_303_441,
    ],
    quaternion: [
      0.683_015_917_688_451_9, 0.183_001_922_925_166_26, 0.683_021_669_059_919,
      -0.182_978_009_565_345_93,
    ],
    scale: 0.036_592_852_216_023_82,
  },
  phone: {
    width: 390,
    height: 841,
    position: [
      -1.978_805_773_131_849_2e-8, 0.449_515_705_103_195_05,
      -1.256_105_232_749_458_8e-9,
    ],
    quaternion: [
      -0.707_106_295_709_032_4, 0.000_859_566_946_948_623_2,
      0.000_860_731_741_724_419_6, 0.707_106_220_347_539_4,
    ],
    scale: 0.017_163_701_117_411_223,
  },
} as const satisfies Record<string, ScreenPlacement>;

export interface SatelliteRig {
  /**
   * Device root offset inside its rig, so the rig turns about the physical
   * display centre rather than Apple's arbitrary AR-scene origin. That keeps
   * the iPad and iPhone in their slots as they travel between poses.
   */
  rootPosition: readonly [number, number, number];
  /** Rig scale that renders the device at its on-screen width (iPad 15.2, iPhone 7.8 units). */
  scale: number;
  /** Rotation that makes the screen face +Z and read upright. */
  upright: Quaternion;
}

export const SATELLITE_RIG = {
  tablet: {
    rootPosition: [
      -1.252_328_196_699_181_7e-7, -0.108_837_186_702_130_5,
      0.132_230_781_857_197_72,
    ],
    scale: 57.691_899_659_400_626,
    upright: new Quaternion(
      0.000_004_066_833_765_423_94,
      -0.258_786_892_042_236_04,
      -0.965_934_440_945_479_8,
      0.000_016_909_298_889_875_354,
    ),
  },
  phone: {
    rootPosition: [
      -0.018_599_999_925_186_24, -1.256_061_921_139_917_1e-11,
      0.004_495_156_950_557_355,
    ],
    scale: 116.524_986_715_985_26,
    upright: new Quaternion(
      -0.001_216_434_868_427_095,
      -0.999_999_260_142_491_2,
      -5.328_862_263_872_825_6e-8,
      8.236_342_846_564_3e-7,
    ),
  },
} as const satisfies Record<string, SatelliteRig>;

/**
 * Sizes the host and builds its `CSS3DObject` under `holder`, a stand-in in
 * the scene for a display mesh that has not loaded yet. Rendering once from
 * here puts the host in the CSS3D layer, so its iframe can start loading
 * before the model arrives; `anchorScreen` moves it onto the mesh later.
 */
export function createScreen(
  holder: Object3D,
  host: HTMLElement,
  placement: ScreenPlacement,
): CSS3DObject {
  host.style.width = `${placement.width.toString()}px`;
  host.style.height = `${placement.height.toString()}px`;

  const object = new CSS3DObject(host);
  object.position.fromArray(placement.position);
  object.quaternion.fromArray(placement.quaternion);
  object.scale.setScalar(placement.scale);
  holder.add(object);
  return object;
}

/**
 * Re-parents the screen onto its display mesh without `Object3D.remove`:
 * CSS3DObject pulls its element out of the DOM on `removed`, and an iframe
 * that leaves the DOM reloads, which would throw away the document that has
 * been loading since `createScreen`.
 */
export function anchorScreen(display: Mesh, object: CSS3DObject): void {
  const holder = object.parent;
  if (holder !== null) {
    holder.children.splice(holder.children.indexOf(object), 1);
    object.parent = null;
  }
  display.add(object);
}

const facingNormal = new Vector3();
const facingOrigin = new Vector3();

/**
 * How squarely a screen faces the camera, 0 → 1. Needs current world matrices.
 *
 * Visibility is gated on this rather than on CSS `backface-visibility`, which
 * CSS3DRenderer's mirrored matrix does not report reliably — without the gate
 * the UI shows through the back of the lid, upside-down and mirrored.
 */
export function screenFacing(
  object: Object3D,
  camera: Camera,
  from: number,
  to: number,
): number {
  facingNormal.setFromMatrixColumn(object.matrixWorld, 2).normalize();
  facingOrigin.setFromMatrixPosition(object.matrixWorld);
  const towardsCamera = facingOrigin.sub(camera.position).negate().normalize();

  return smoothstep(from, to, facingNormal.dot(towardsCamera));
}
