import { Group, Vector3 } from "three";
import type { Mesh, Object3D } from "three";
import { USDLoader } from "three/examples/jsm/loaders/USDLoader.js";

import {
  disposeObject,
  isMesh,
  isStandardMaterial,
  materialsOf,
  sortedExtents,
} from "./utils";

/**
 * Apple's public AR assets; `public/models/README.md` records their provenance.
 * Each file also ships alternate configurations — the iPad's Magic Keyboard and
 * Pencil, the iPhone Pro Max — so only the named product is kept.
 */
const DEVICES = {
  laptop: { url: "/models/macbook-pro-14-space-black.usdz" },
  tablet: { url: "/models/ipad-pro-space-black.usdz" },
  phone: { url: "/models/iphone-17-pro-e-sim.usdz" },
} as const;

export const DISPLAY_ASSEMBLY_NAME = "RcexTyyhpuJYATQ";

export interface DeviceModels {
  laptop: Object3D;
  tablet: Group;
  phone: Group;
}

function isolateProduct(root: Object3D, productName: string): Group {
  root.updateMatrixWorld(true);
  const product = root.getObjectByName(productName);
  if (product === undefined) {
    throw new Error(`Apple product part ${productName} was not found.`);
  }

  const isolated = new Group();
  isolated.attach(product);
  disposeObject(root);
  return isolated;
}

/**
 * Apple's public iPhone AR file ships in Cosmic Orange. Only the orange
 * anodised shell materials are re-toned to Testownik's deep navy; glass,
 * cameras, controls and the screen are left alone.
 */
function retoneShell(phone: Object3D): void {
  phone.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }

    for (const material of materialsOf(object)) {
      if (!isStandardMaterial(material)) {
        continue;
      }
      const { color } = material;
      if (color.r > color.g * 2 && color.r > color.b * 1.6) {
        color.set(0x22_35_5d);
        material.roughness = Math.max(material.roughness, 0.32);
        material.needsUpdate = true;
      }
    }
  });
}

/** Turns a lit display panel into inert black glass for the DOM screen to sit on. */
function blankDisplayMaterial(mesh: Mesh, color: number): boolean {
  let wasEmissive = false;

  for (const material of materialsOf(mesh)) {
    if (isStandardMaterial(material) && material.emissiveMap != null) {
      wasEmissive = true;
      material.emissiveMap = null;
      material.map = null;
      material.emissive.set(0x00_00_00);
      material.color.set(color);
      material.needsUpdate = true;
    }
  }

  return wasEmissive;
}

/** The mesh's dimensions, largest first, so `[0] × [1]` is its face. */
function faceExtents(mesh: Mesh): number[] | null {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  return box === null ? null : sortedExtents(box.getSize(new Vector3()));
}

function largestFace(candidates: { mesh: Mesh; area: number }[]): Mesh | null {
  return (
    candidates.toSorted((first, second) => second.area - first.area).at(0)
      ?.mesh ?? null
  );
}

/**
 * The MacBook panel is the one large emissive surface inside the lid assembly.
 * Every emissive material in the assembly is blanked on the way past, not only
 * the winner's, so no baked-in screenshot shows through anywhere on the lid.
 */
export function takeLaptopPanel(displayAssembly: Object3D): Mesh | null {
  const candidates: { mesh: Mesh; area: number }[] = [];

  displayAssembly.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }

    const extents = faceExtents(object);
    const wasEmissive = blankDisplayMaterial(object, 0x03_04_05);
    if (
      extents === null ||
      !wasEmissive ||
      extents[0] < 20 ||
      extents[1] < 10
    ) {
      return;
    }

    candidates.push({ mesh: object, area: extents[0] * extents[1] });
  });

  return largestFace(candidates);
}

/** The largest emissive plane in a satellite device is its display. */
export function takeSatelliteDisplay(root: Object3D): Mesh {
  const candidates: { mesh: Mesh; area: number }[] = [];

  root.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }

    const extents = faceExtents(object);
    const isEmissive = materialsOf(object).some(
      (material) =>
        isStandardMaterial(material) && material.emissiveMap != null,
    );

    if (extents !== null && isEmissive && extents[0] > 4 && extents[1] > 3) {
      candidates.push({ mesh: object, area: extents[0] * extents[1] });
    }
  });

  const display = largestFace(candidates);
  if (display === null) {
    throw new Error("A satellite display surface could not be located.");
  }

  blankDisplayMaterial(display, 0x02_03_05);
  return display;
}

export async function loadDeviceModels(): Promise<DeviceModels> {
  const loader = new USDLoader();
  const [laptop, tablet, phone] = await Promise.all([
    loader.loadAsync(DEVICES.laptop.url),
    loader.loadAsync(DEVICES.tablet.url),
    loader.loadAsync(DEVICES.phone.url),
  ]);

  const models: DeviceModels = {
    laptop,
    tablet,
    phone,
  };

  retoneShell(models.phone);
  for (const product of [models.laptop, models.tablet, models.phone]) {
    product.traverse((object) => {
      if (isMesh(object)) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  return models;
}

export function disposeModels(models: Partial<DeviceModels>): void {
  for (const model of [models.laptop, models.tablet, models.phone]) {
    if (model !== undefined) {
      disposeObject(model);
    }
  }
}
