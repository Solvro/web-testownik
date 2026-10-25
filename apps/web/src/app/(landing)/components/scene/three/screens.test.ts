import { NodeIO } from "@gltf-transform/core";
import type { Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import path from "node:path";
import { Quaternion, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { SCREEN_PLACEMENT } from "./screens";
import type { ScreenPlacement } from "./screens";

/**
 * Guards the baked screen placements against the model they were measured
 * from. Each display mesh is re-measured in the plane the baked rotation
 * describes; if `device-stack.glb` is regenerated with different geometry,
 * the placement, scale or host height stops matching and this fails.
 */

const MODEL_PATH = path.resolve(
  import.meta.dirname,
  "../../../../../../public/models/device-stack.glb",
);

/** Gap along the normal so the DOM plane does not z-fight the glass. */
const CLEARANCE = { laptop: 0.02, tablet: 0.012, phone: 0.012 } as const;

let document: Document;

beforeAll(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  document = await io.read(MODEL_PATH);
});

function displayVertices(name: string): Vector3[] {
  const node = document
    .getRoot()
    .listNodes()
    .find((candidate) => candidate.getName() === name);
  const positions = node
    ?.getMesh()
    ?.listPrimitives()[0]
    ?.getAttribute("POSITION");
  if (positions === null || positions === undefined) {
    throw new Error(`The model has no "${name}" mesh.`);
  }

  const vertices: Vector3[] = [];
  const element: number[] = [];
  for (let index = 0; index < positions.getCount(); index += 1) {
    positions.getElement(index, element);
    vertices.push(new Vector3().fromArray(element));
  }
  return vertices;
}

function measure(
  vertices: Vector3[],
  placement: ScreenPlacement,
  clearance: number,
): { position: Vector3; scale: number; height: number } {
  const rotation = new Quaternion().fromArray(placement.quaternion);
  const right = new Vector3(1, 0, 0).applyQuaternion(rotation);
  const up = new Vector3(0, 1, 0).applyQuaternion(rotation);
  const normal = new Vector3(0, 0, 1).applyQuaternion(rotation);

  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  let maxN = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    const u = vertex.dot(right);
    const v = vertex.dot(up);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
    maxN = Math.max(maxN, vertex.dot(normal));
  }

  const width = maxU - minU;
  return {
    position: right
      .multiplyScalar((minU + maxU) / 2)
      .addScaledVector(up, (minV + maxV) / 2)
      .addScaledVector(normal, maxN + clearance),
    scale: width / placement.width,
    height: Math.round((placement.width * (maxV - minV)) / width),
  };
}

describe("baked screen placements", () => {
  for (const device of ["laptop", "tablet", "phone"] as const) {
    it(`match the ${device} display mesh`, () => {
      const placement = SCREEN_PLACEMENT[device];
      const measured = measure(
        displayVertices(`${device}-display`),
        placement,
        CLEARANCE[device],
      );
      const report = JSON.stringify({
        position: measured.position.toArray(),
        scale: measured.scale,
        height: measured.height,
      });

      expect(measured.height, report).toBe(placement.height);
      expect(measured.scale, report).toBeCloseTo(placement.scale, 6);
      for (const [axis, value] of measured.position.toArray().entries()) {
        expect(value, report).toBeCloseTo(placement.position[axis], 4);
      }
    });
  }
});
