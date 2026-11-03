import type {
  Line,
  Material,
  Mesh,
  Object3D,
  Points,
  Texture,
  Vector3,
} from "three";

export function isMesh(object: Object3D): object is Mesh {
  return "isMesh" in object && object.isMesh === true;
}

/** Meshes, points and lines: everything that owns geometry and materials. */
function isDrawable(object: Object3D): object is Mesh | Points | Line {
  return (
    isMesh(object) ||
    ("isPoints" in object && object.isPoints === true) ||
    ("isLine" in object && object.isLine === true)
  );
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === "object" &&
    value !== null &&
    "isTexture" in value &&
    value.isTexture === true
  );
}

function materialsOf(object: Mesh | Points | Line): Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

export function smoothstep(from: number, to: number, value: number): number {
  const normalized = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return normalized * normalized * (3 - 2 * normalized);
}

/** Writes the cubic Bézier point at `progress` into `target`. */
export function setCubicBezier(
  target: Vector3,
  start: Vector3,
  controlOne: Vector3,
  controlTwo: Vector3,
  end: Vector3,
  progress: number,
): void {
  const inverse = 1 - progress;
  target
    .copy(start)
    .multiplyScalar(inverse ** 3)
    .addScaledVector(controlOne, 3 * inverse ** 2 * progress)
    .addScaledVector(controlTwo, 3 * inverse * progress ** 2)
    .addScaledVector(end, progress ** 3);
}

/** Releases every geometry, material and texture under `root`. */
export function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    if (!isDrawable(object)) {
      return;
    }

    object.geometry.dispose();
    for (const material of materialsOf(object)) {
      for (const value of Object.values(material)) {
        if (isTexture(value)) {
          value.dispose();
        }
      }
      material.dispose();
    }
  });
}
