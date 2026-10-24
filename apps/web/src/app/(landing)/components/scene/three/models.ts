import type { Mesh, Object3D } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { disposeObject, isMesh } from "./utils";

/**
 * One meshopt-compressed GLB holding all three devices, produced offline by
 * `pnpm export:device-models` from Apple's AR files. The export has already
 * blanked the displays, re-parented the MacBook lid onto its hinge and named
 * every node the hero needs; `public/models/README.md` records the details.
 */
export const DEVICE_MODELS_URL = "/models/device-stack.glb";

export interface DeviceModels {
  laptop: {
    root: Object3D;
    /** Pivot at the hinge axis; rotating it about X opens the lid. */
    hinge: Object3D;
    display: Mesh;
  };
  tablet: { root: Object3D; display: Mesh };
  phone: { root: Object3D; display: Mesh };
}

function requireObject(root: Object3D, name: string): Object3D {
  const object = root.getObjectByName(name);
  if (object === undefined) {
    throw new Error(`The device model has no "${name}" node.`);
  }
  return object;
}

function requireMesh(root: Object3D, name: string): Mesh {
  const object = requireObject(root, name);
  if (!isMesh(object)) {
    throw new Error(`The device model's "${name}" node is not a mesh.`);
  }
  return object;
}

export async function loadDeviceModels(
  signal: AbortSignal,
): Promise<DeviceModels> {
  const response = await fetch(DEVICE_MODELS_URL, { signal });
  if (!response.ok) {
    throw new Error(
      `Device models failed to load: HTTP ${String(response.status)}.`,
    );
  }
  const buffer = await response.arrayBuffer();

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { scene } = await loader.parseAsync(buffer, "");

  const laptop = requireObject(scene, "laptop");
  const tablet = requireObject(scene, "tablet");
  const phone = requireObject(scene, "phone");

  return {
    laptop: {
      root: laptop,
      hinge: requireObject(laptop, "laptop-hinge"),
      display: requireMesh(laptop, "laptop-display"),
    },
    tablet: { root: tablet, display: requireMesh(tablet, "tablet-display") },
    phone: { root: phone, display: requireMesh(phone, "phone-display") },
  };
}

export function disposeModels(models: DeviceModels): void {
  for (const { root } of [models.laptop, models.tablet, models.phone]) {
    disposeObject(root);
  }
}
