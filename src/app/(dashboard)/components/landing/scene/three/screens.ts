import { Matrix4, Quaternion, Vector3 } from "three";
import type {
  Camera,
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
} from "three";
import { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

import {
  measureInPlane,
  resolveDisplayBasis,
  resolvePanelBasis,
} from "./display-plane";
import type {
  DisplayOrientation,
  PlaneBasis,
  PlaneExtents,
} from "./display-plane";
import { takeSatelliteDisplay } from "./models";
import { smoothstep } from "./utils";

/**
 * The live UI is a `CSS3DObject` parented to the display mesh itself, so it
 * inherits the hinge rotation, the model yaw and the camera perspective. An
 * earlier version projected four corners through the camera by hand and could
 * never be made stable — do not go back to a flat overlay.
 */

/** Camera pose the MacBook panel's basis is resolved against: the finished hero shot. */
export function poseForMeasurement(camera: PerspectiveCamera): void {
  camera.position.set(0, 11.8, 50);
  camera.lookAt(0, 7.4, -1.8);
  camera.updateMatrixWorld(true);
}

/** Gives the host the display's aspect ratio at a fixed logical width. */
function sizeHost(
  host: HTMLElement,
  logicalWidth: number,
  extents: PlaneExtents,
): void {
  host.style.width = `${logicalWidth.toString()}px`;
  host.style.height = `${Math.round(
    (logicalWidth * extents.height) / extents.width,
  ).toString()}px`;
}

function placeScreen(
  object: CSS3DObject,
  basis: PlaneBasis,
  extents: PlaneExtents,
  logicalWidth: number,
  /** Clearance along the normal so the DOM plane does not z-fight the glass. */
  clearance: number,
): void {
  object.position
    .copy(basis.right)
    .multiplyScalar((extents.minU + extents.maxU) / 2)
    .addScaledVector(basis.up, (extents.minV + extents.maxV) / 2)
    .addScaledVector(basis.normal, extents.maxN + clearance);
  object.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(basis.right, basis.up, basis.normal),
  );
  object.scale.setScalar(extents.width / logicalWidth);
}

/**
 * Anchors the app screen to the MacBook panel. The camera must already be in
 * the reference pose — the panel's facing direction is resolved against it.
 */
export function attachLaptopScreen({
  panel,
  host,
  camera,
  logicalWidth,
}: {
  panel: Mesh;
  host: HTMLElement;
  camera: Camera;
  logicalWidth: number;
}): CSS3DObject {
  const basis = resolvePanelBasis(panel, camera);
  const extents = measureInPlane(panel, basis);

  sizeHost(host, logicalWidth, extents);
  const object = new CSS3DObject(host);
  placeScreen(object, basis, extents, logicalWidth, 0.02);
  panel.add(object);

  return object;
}

export interface SatelliteAttachment {
  object: CSS3DObject;
  /** Rig scale that renders the device at the requested on-screen width. */
  scale: number;
  /** Rotation that makes the screen face +Z and read upright. */
  upright: Quaternion;
}

export function attachSatelliteScreen({
  scene,
  root,
  rig,
  host,
  logicalWidth,
  targetWidth,
  restPosition,
  orientation,
}: {
  scene: Scene;
  root: Object3D;
  rig: Group;
  host: HTMLElement;
  logicalWidth: number;
  /** Width the device should occupy in scene units once scaled. */
  targetWidth: number;
  restPosition: Vector3;
  orientation: DisplayOrientation;
}): SatelliteAttachment {
  rig.add(root);
  scene.add(rig);
  rig.position.copy(restPosition);
  rig.rotation.set(0, 0, 0);
  scene.updateMatrixWorld(true);

  const display = takeSatelliteDisplay(root);
  const basis = resolveDisplayBasis(display, root, orientation);
  const extents = measureInPlane(display, basis);

  sizeHost(host, logicalWidth, extents);
  const object = new CSS3DObject(host);
  placeScreen(object, basis, extents, logicalWidth, 0.012);
  display.add(object);
  scene.updateMatrixWorld(true);

  // Apple composes each product around an arbitrary AR-scene origin. Rotating
  // around the physical display centre instead keeps the iPad and iPhone in
  // their slots as they travel between the closed and upright poses.
  const displayCentre = rig.worldToLocal(
    object.getWorldPosition(new Vector3()),
  );
  root.position.addScaledVector(displayCentre, -1);
  scene.updateMatrixWorld(true);

  // USD stages commonly carry a centimetre-to-scene scale on an ancestor, so
  // the CSS plane is measured after the full transform chain rather than from
  // the authored numbers.
  const attachedWidth = logicalWidth * object.getWorldScale(new Vector3()).x;
  const scale = targetWidth / Math.max(attachedWidth, 0.001);
  rig.scale.setScalar(scale);
  scene.updateMatrixWorld(true);

  // Derived from the display object rather than assuming a model axis: the
  // corrected screen faces +Z and reads upright, and the shell follows it.
  const upright = object.getWorldQuaternion(new Quaternion()).invert();
  rig.quaternion.copy(upright);
  scene.updateMatrixWorld(true);

  return { object, scale, upright };
}

/**
 * How squarely a screen faces the camera, 0 → 1.
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
  const normal = new Vector3()
    .setFromMatrixColumn(object.matrixWorld, 2)
    .normalize();
  const origin = new Vector3().setFromMatrixPosition(object.matrixWorld);
  const towardsCamera = camera.position.clone().sub(origin).normalize();

  return smoothstep(from, to, normal.dot(towardsCamera));
}
