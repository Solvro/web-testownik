/**
 * Runs inside headless Chrome (see `export-device-models.mjs`): bakes the
 * hero's fix-ups into Apple's USDZ files and exports one glTF with the node
 * names in `public/models/README.md`. A browser rather than Node because
 * USDLoader decodes textures through `Image` and GLTFExporter re-encodes them
 * through a canvas.
 */
import { Group, Vector3 } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { USDLoader } from "three/addons/loaders/USDLoader.js";

/** Opaque prim name of the MacBook lid assembly in Apple's file. */
const LID_ASSEMBLY_NAME = "RcexTyyhpuJYATQ";

/** Hinge pivot, in the lid assembly's parent space, measured from the model. */
const HINGE_POSITION = new Vector3(0, -0.09, -10.78);

/** Inert glass the live DOM screens sit on. */
const LAPTOP_GLASS = 0x03_04_05;
const SATELLITE_GLASS = 0x02_03_05;

/**
 * The hero's iPhone is navy. The trimmed `iphone.usdz` has a near-black
 * `#020305` shell without its roughness map, which renders pure black with no
 * environment map, and leaves some of Apple's Cosmic Orange parts; both are
 * re-toned.
 */
const PHONE_SHELL_COLOR = 0x22_35_5d;
const TRIMMED_SHELL_COLOR = 0x02_03_05;
/** Mean of the shell roughness map the trim dropped; Apple's factor is 1. */
const TRIMMED_SHELL_ROUGHNESS = 0.41;

const materialsOf = (mesh) =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material];

const hasEmissiveMap = (mesh) =>
  materialsOf(mesh).some((material) => material.emissiveMap != null);

/** Turns a lit display panel into black glass. */
function blankDisplayMaterial(mesh, color) {
  let wasEmissive = false;
  for (const material of materialsOf(mesh)) {
    if (material.emissiveMap != null) {
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
function faceExtents(mesh) {
  mesh.geometry.computeBoundingBox();
  const size = mesh.geometry.boundingBox.getSize(new Vector3());
  return [size.x, size.y, size.z].toSorted((first, second) => second - first);
}

function largestFace(candidates) {
  return (
    candidates.toSorted((first, second) => second.area - first.area).at(0)
      ?.mesh ?? null
  );
}

/**
 * The MacBook panel is the one large emissive surface inside the lid assembly.
 * Every emissive material in the assembly is blanked, not only the winner's,
 * so no baked-in screenshot shows through anywhere on the lid.
 */
function takeLaptopPanel(assembly) {
  const candidates = [];
  assembly.traverse((object) => {
    if (object.isMesh !== true) {
      return;
    }
    const extents = faceExtents(object);
    const wasEmissive = blankDisplayMaterial(object, LAPTOP_GLASS);
    if (wasEmissive && extents[0] >= 20 && extents[1] >= 10) {
      candidates.push({ mesh: object, area: extents[0] * extents[1] });
    }
  });
  return largestFace(candidates);
}

/** The largest emissive plane in a satellite device is its display. */
function takeSatelliteDisplay(root) {
  const candidates = [];
  root.traverse((object) => {
    if (object.isMesh !== true || !hasEmissiveMap(object)) {
      return;
    }
    const extents = faceExtents(object);
    if (extents[0] > 4 && extents[1] > 3) {
      candidates.push({ mesh: object, area: extents[0] * extents[1] });
    }
  });
  const display = largestFace(candidates);
  if (display === null) {
    throw new Error(`No display surface found in ${root.name}.`);
  }
  blankDisplayMaterial(display, SATELLITE_GLASS);
  return display;
}

function prepareLaptop(root) {
  root.name = "laptop";

  const assembly = root.getObjectByName(LID_ASSEMBLY_NAME);
  if (assembly?.parent == null) {
    throw new Error("The MacBook lid assembly could not be located.");
  }
  const panel = takeLaptopPanel(assembly);
  if (panel === null) {
    throw new Error("The MacBook display panel could not be located.");
  }

  const hinge = new Group();
  hinge.name = "laptop-hinge";
  hinge.position.copy(HINGE_POSITION);
  assembly.parent.add(hinge);
  hinge.attach(assembly);

  assembly.name = "laptop-lid";
  panel.name = "laptop-display";

  // The hero drives the laptop's rotation itself and starts from identity.
  root.rotation.set(0, 0, 0);
}

/** Restores the hero's navy iPhone shell; see `PHONE_SHELL_COLOR`. */
function retonePhoneShell(phone) {
  let retoned = 0;
  phone.traverse((object) => {
    if (object.isMesh !== true) {
      return;
    }
    for (const material of materialsOf(object)) {
      const { color } = material;
      if (material.emissiveMap != null) {
        continue;
      }
      if (color.getHex() === TRIMMED_SHELL_COLOR) {
        material.roughness = TRIMMED_SHELL_ROUGHNESS;
      } else if (color.r > color.g * 2 && color.r > color.b * 1.6) {
        material.roughness = Math.max(material.roughness, 0.32);
      } else {
        continue;
      }
      color.set(PHONE_SHELL_COLOR);
      retoned += 1;
    }
  });
  if (retoned === 0) {
    throw new Error("No iPhone shell material found to re-tone.");
  }
}

function prepareSatellite(root, name) {
  root.name = name;
  takeSatelliteDisplay(root).name = `${name}-display`;
}

const displayNames = new Set([
  "laptop-display",
  "tablet-display",
  "phone-display",
]);

/**
 * No material samples the second UV set, and untextured parts need no UVs.
 * The displays keep theirs: they give each screen's in-plane axes.
 */
function stripUnusedAttributes(root) {
  root.traverse((object) => {
    if (object.isMesh !== true) {
      return;
    }
    const textures = materialsOf(object).flatMap((material) =>
      Object.values(material).filter((value) => value?.isTexture === true),
    );
    if (textures.some((texture) => texture.channel !== 0)) {
      throw new Error(`${object.name} samples a secondary UV set.`);
    }
    object.geometry.deleteAttribute("uv1");
    if (textures.length === 0 && !displayNames.has(object.name)) {
      object.geometry.deleteAttribute("uv");
    }
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x80_00) {
    binary += String.fromCodePoint(...bytes.subarray(index, index + 0x80_00));
  }
  return btoa(binary);
}

async function exportDeviceModels() {
  const loader = new USDLoader();
  const [laptop, tablet, phone] = await Promise.all([
    loader.loadAsync("/source/macbook.usdz"),
    loader.loadAsync("/source/ipad.usdz"),
    loader.loadAsync("/source/iphone.usdz"),
  ]);

  prepareLaptop(laptop);
  prepareSatellite(tablet, "tablet");
  // Before the display is blanked: its glass is `#020305` too.
  retonePhoneShell(phone);
  prepareSatellite(phone, "phone");

  for (const root of [laptop, tablet, phone]) {
    stripUnusedAttributes(root);
  }

  const glb = await new GLTFExporter().parseAsync([laptop, tablet, phone], {
    binary: true,
  });
  return toBase64(glb);
}

window.exportDeviceModels = exportDeviceModels;
