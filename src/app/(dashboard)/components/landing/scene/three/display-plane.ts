import { Box3, Matrix4, Vector3 } from "three";
import type { Camera, Mesh, Object3D } from "three";

/**
 * Recovering the plane a device's screen actually lies in.
 *
 * None of these models can be measured with an axis-aligned bounding box: Apple
 * authors each AR composition in its own pose, and the MacBook's glass quad is
 * tilted ~20° inside its own frame, which a box reports as a 6.7-unit-thick
 * "panel". Every basis here is therefore derived from the geometry itself.
 */

export interface PlaneBasis {
  /** Outward face normal. */
  normal: Vector3;
  right: Vector3;
  up: Vector3;
}

export interface PlaneExtents {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  /** Furthest vertex along the normal — where the DOM plane has to sit. */
  maxN: number;
  width: number;
  height: number;
}

/**
 * Mean vertex normal with back-facing normals folded onto the front, which
 * gives the plane of a two-sided quad instead of cancelling out.
 */
function averageNormal(mesh: Mesh): Vector3 {
  const normals = mesh.geometry.getAttribute("normal");
  const total = new Vector3();
  const reference = new Vector3().fromBufferAttribute(normals, 0);
  const sample = new Vector3();

  for (let index = 0; index < normals.count; index += 1) {
    sample.fromBufferAttribute(normals, index);
    total.addScaledVector(sample, sample.dot(reference) >= 0 ? 1 : -1);
  }

  return total.normalize();
}

/** Measures the mesh in its own plane rather than in model axes. */
export function measureInPlane(mesh: Mesh, basis: PlaneBasis): PlaneExtents {
  const positions = mesh.geometry.getAttribute("position");
  const vertex = new Vector3();
  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  let maxN = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index);
    const u = vertex.dot(basis.right);
    const v = vertex.dot(basis.up);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    maxN = Math.max(maxN, vertex.dot(basis.normal));
  }

  return {
    minU,
    maxU,
    minV,
    maxV,
    maxN,
    width: maxU - minU,
    height: maxV - minV,
  };
}

/**
 * The MacBook panel. It only ever appears in one pose, so "faces the camera"
 * and "world up is up" are meaningful tests, and `up × normal` guarantees a
 * right-handed frame — otherwise the UI renders mirrored.
 */
export function resolvePanelBasis(panel: Mesh, camera: Camera): PlaneBasis {
  const normal = averageNormal(panel);
  const toLocal = new Matrix4().copy(panel.matrixWorld).invert();
  const toCamera = camera.position
    .clone()
    .sub(panel.getWorldPosition(new Vector3()))
    .transformDirection(toLocal);

  if (normal.dot(toCamera) < 0) {
    normal.negate();
  }

  const up = new Vector3(0, 1, 0)
    .transformDirection(toLocal)
    .projectOnPlane(normal)
    .normalize();

  return { normal, right: new Vector3().crossVectors(up, normal), up };
}

/** Mean vertex position of the mesh, in its own local space. */
function centroidOf(mesh: Mesh): Vector3 {
  const positions = mesh.geometry.getAttribute("position");
  const center = new Vector3();
  const vertex = new Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    center.add(vertex.fromBufferAttribute(positions, index));
  }

  return center.multiplyScalar(1 / positions.count);
}

/**
 * In-plane axes from the display's own UVs: the direction in which U grows is
 * the screen's right, and V its up. Stable regardless of the authored pose.
 * Returns false when the model has no usable UV set.
 */
function axesFromTextureCoordinates(
  display: Mesh,
  normal: Vector3,
  center: Vector3,
  right: Vector3,
  up: Vector3,
): boolean {
  const positions = display.geometry.getAttribute("position");
  const textureCoordinates = display.geometry.getAttribute("uv");
  if (textureCoordinates.count !== positions.count) {
    return false;
  }

  let meanU = 0;
  let meanV = 0;
  for (let index = 0; index < textureCoordinates.count; index += 1) {
    meanU += textureCoordinates.getX(index);
    meanV += textureCoordinates.getY(index);
  }
  meanU /= textureCoordinates.count;
  meanV /= textureCoordinates.count;

  const vertex = new Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index).sub(center);
    right.addScaledVector(vertex, textureCoordinates.getX(index) - meanU);
    up.addScaledVector(vertex, textureCoordinates.getY(index) - meanV);
  }

  right.projectOnPlane(normal).normalize();
  up.projectOnPlane(normal).addScaledVector(right, -up.dot(right)).normalize();

  return right.lengthSq() >= 0.5 && up.lengthSq() >= 0.5;
}

/**
 * Fallback for a model without usable UVs: principal-axis analysis still
 * recovers the long edge of a planar display.
 */
function axesFromPrincipalAxes(
  display: Mesh,
  normal: Vector3,
  center: Vector3,
  orientation: DisplayOrientation,
  right: Vector3,
  up: Vector3,
): void {
  const positions = display.geometry.getAttribute("position");
  const seed =
    Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const tangent = seed.projectOnPlane(normal).normalize();
  const bitangent = new Vector3().crossVectors(normal, tangent).normalize();

  const vertex = new Vector3();
  let covarianceUU = 0;
  let covarianceUV = 0;
  let covarianceVV = 0;
  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index).sub(center);
    const u = vertex.dot(tangent);
    const v = vertex.dot(bitangent);
    covarianceUU += u * u;
    covarianceUV += u * v;
    covarianceVV += v * v;
  }

  const angle = Math.atan2(covarianceUV * 2, covarianceUU - covarianceVV) / 2;
  const longAxis = tangent
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(bitangent, Math.sin(angle))
    .normalize();
  const shortAxis = new Vector3().crossVectors(normal, longAxis).normalize();

  if (orientation === "landscape") {
    right.copy(longAxis);
    up.copy(shortAxis).negate();
  } else {
    right.copy(shortAxis);
    up.copy(longAxis);
  }
}

export type DisplayOrientation = "landscape" | "portrait";

/**
 * The iPad and iPhone displays.
 *
 * Which way a display faces has to be decided from the device itself, never
 * from the camera: Apple poses the iPhone with its screen away from the default
 * view, so a camera-relative test picks the *back* face, and the rig then
 * dutifully rotates the handset to present the Apple logo and camera bump with
 * the live UI floating on top. The outward normal is the one pointing away from
 * the shell's centre.
 */
export function resolveDisplayBasis(
  display: Mesh,
  body: Object3D,
  orientation: DisplayOrientation,
): PlaneBasis {
  const normal = averageNormal(display);
  const toLocal = new Matrix4().copy(display.matrixWorld).invert();
  const bodyCentre = new Box3().setFromObject(body).getCenter(new Vector3());
  const outward = display
    .getWorldPosition(new Vector3())
    .sub(bodyCentre)
    .transformDirection(toLocal);

  if (outward.lengthSq() > 1e-6 && normal.dot(outward) < 0) {
    normal.negate();
  }

  const center = centroidOf(display);
  const right = new Vector3();
  const up = new Vector3();
  if (!axesFromTextureCoordinates(display, normal, center, right, up)) {
    axesFromPrincipalAxes(display, normal, center, orientation, right, up);
  }

  if (new Vector3().crossVectors(right, up).dot(normal) < 0) {
    up.negate();
  }

  const basis: PlaneBasis = { normal, right, up };
  const authored = measureInPlane(display, basis);
  const isRotated =
    orientation === "landscape"
      ? authored.width < authored.height
      : authored.width > authored.height;

  if (isRotated) {
    const previousRight = right.clone();
    right.copy(up);
    up.copy(previousRight).negate();
  }

  return basis;
}
