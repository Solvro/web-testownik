import { TextureInfo } from "@gltf-transform/core";
import { KHRTextureTransform } from "@gltf-transform/extensions";

/** Every texture slot of a material, including those of its extensions. */
function textureInfosOf(document, material) {
  const graph = document.getGraph();
  const found = [];
  const visit = (property) => {
    for (const edge of graph.listChildEdges(property)) {
      const child = edge.getChild();
      if (child instanceof TextureInfo) {
        found.push(child);
      } else if (child.propertyType !== "Texture") {
        visit(child);
      }
    }
  };
  visit(material);
  return found;
}

/**
 * glTF Transform only quantises UVs that already lie in [0, 1], and Apple's
 * tiling aluminium and glass maps do not. This remaps every material's UVs
 * into [0, 1] and puts the original range back with `KHR_texture_transform`,
 * which three applies before sampling — so the result is the same texel, and
 * the same derivative-based normal-map frame, at a third of the size.
 *
 * Materials without textures need no transform; their UVs are only read by
 * the hero to find a display's in-plane axes, which a positive per-axis scale
 * and offset leave unchanged.
 */
export function normalizeTexcoords(document) {
  const transformExtension = document.createExtension(KHRTextureTransform);
  const primitivesByMaterial = new Map();

  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getAttribute("TEXCOORD_0") === null) {
        continue;
      }
      const material = primitive.getMaterial();
      const list = primitivesByMaterial.get(material) ?? [];
      list.push(primitive);
      primitivesByMaterial.set(material, list);
    }
  }

  for (const [material, primitives] of primitivesByMaterial) {
    const min = [Infinity, Infinity];
    const max = [-Infinity, -Infinity];
    for (const primitive of primitives) {
      const accessor = primitive.getAttribute("TEXCOORD_0");
      const element = [0, 0];
      for (let index = 0; index < accessor.getCount(); index += 1) {
        accessor.getElement(index, element);
        for (const axis of [0, 1]) {
          min[axis] = Math.min(min[axis], element[axis]);
          max[axis] = Math.max(max[axis], element[axis]);
        }
      }
    }

    if (min.every((value) => value >= 0) && max.every((value) => value <= 1)) {
      continue;
    }

    const scale = [0, 1].map((axis) => Math.max(max[axis] - min[axis], 1e-6));

    for (const primitive of primitives) {
      // Accessors may be shared after dedup; remap a private copy.
      const accessor = primitive.getAttribute("TEXCOORD_0").clone();
      const element = [0, 0];
      for (let index = 0; index < accessor.getCount(); index += 1) {
        accessor.getElement(index, element);
        accessor.setElement(index, [
          (element[0] - min[0]) / scale[0],
          (element[1] - min[1]) / scale[1],
        ]);
      }
      primitive.setAttribute("TEXCOORD_0", accessor);
    }

    if (material === null) {
      continue;
    }
    for (const info of textureInfosOf(document, material)) {
      if (
        info.getTexCoord() !== 0 ||
        info.getExtension("KHR_texture_transform") !== null
      ) {
        throw new Error(`Unexpected texture mapping on ${material.getName()}.`);
      }
      info.setExtension(
        "KHR_texture_transform",
        transformExtension
          .createTransform()
          .setOffset([min[0], min[1]])
          .setScale([scale[0], scale[1]]),
      );
    }
  }
}
