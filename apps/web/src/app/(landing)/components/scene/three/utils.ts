import type { Material, Mesh, Object3D, Texture, Vector3 } from "three";

export function isMesh(object: Object3D): object is Mesh {
  return "isMesh" in object && object.isMesh === true;
}

function isTexture(value: unknown): value is Texture {
  return (
    typeof value === "object" &&
    value !== null &&
    "isTexture" in value &&
    value.isTexture === true
  );
}

function materialsOf(mesh: Mesh): Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
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
    if (!isMesh(object)) {
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
