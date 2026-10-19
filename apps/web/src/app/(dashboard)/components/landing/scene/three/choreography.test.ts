import { NodeIO } from "@gltf-transform/core";
import type { Document, Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import path from "node:path";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { beforeAll, describe, expect, it } from "vitest";

import { CAMERA_FOV } from "../laptop-framing";
import { createChoreography } from "./choreography";
import { SATELLITE_RIG } from "./screens";
import { isMesh } from "./utils";

let model: Document;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  model = await new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.decoder": MeshoptDecoder })
    .read(
      path.resolve(
        import.meta.dirname,
        "../../../../../../../public/models/device-stack.glb",
      ),
    );
});

/** Real model geometry and transforms; materials are irrelevant to framing. */
function modelObject(node: Node): Group {
  const object = new Group();
  object.name = node.getName();
  object.position.fromArray(node.getTranslation());
  object.quaternion.fromArray(node.getRotation());
  object.scale.fromArray(node.getScale());
  for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const positions = primitive.getAttribute("POSITION");
    if (positions != null) {
      const vertices = new Float32Array(positions.getCount() * 3);
      const vertex: number[] = [];
      for (let index = 0; index < positions.getCount(); index += 1) {
        positions.getElement(index, vertex);
        vertices.set(vertex, index * 3);
      }
      const geometry = new BufferGeometry().setAttribute(
        "position",
        new BufferAttribute(vertices, 3),
      );
      object.add(new Mesh(geometry));
    }
  }
  for (const child of node.listChildren()) {
    object.add(modelObject(child));
  }
  return object;
}

function setup(width: number, height: number) {
  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, width / height, 0.1, 400);
  const device = (name: string): Group => {
    const node = model
      .getRoot()
      .listNodes()
      .find((n) => n.getName() === name);
    if (node === undefined) {
      throw new Error(`Missing model: ${name}`);
    }
    return modelObject(node);
  };
  const laptop = device("laptop");
  const lidPivot = laptop.getObjectByName("laptop-hinge");
  if (lidPivot === undefined) {
    throw new Error("Missing laptop hinge");
  }
  const satellites = (["tablet", "phone"] as const).map((name) => {
    const root = device(name);
    const placement = SATELLITE_RIG[name];
    root.position.fromArray(placement.rootPosition);
    const rig = new Group().add(root);
    scene.add(rig);
    return { rig, placement };
  });
  scene.add(laptop);
  const choreography = createChoreography({
    scene,
    camera,
    laptop,
    lidPivot,
    tablet: satellites[0],
    phone: satellites[1],
  });
  return { camera, laptop, satellites, choreography };
}

describe("satellite framing against the device model", () => {
  for (const [width, viewportHeight] of [
    [1280, 800],
    [1440, 900],
    [1536, 864],
    [1680, 1050],
    [1920, 1080],
    [1280, 1200],
  ]) {
    it(`keeps open devices inside ${String(width)}×${String(viewportHeight)}`, () => {
      const height = viewportHeight - 5.3 * 16;
      const { camera, satellites, choreography } = setup(width, height);
      choreography.apply(1, width, height);
      camera.updateMatrixWorld();
      for (const { rig } of satellites) {
        rig.traverse((object) => {
          if (!isMesh(object)) {
            return;
          }
          const positions = object.geometry.getAttribute("position");
          for (let index = 0; index < positions.count; index += 1) {
            const point = new Vector3()
              .fromBufferAttribute(positions, index)
              .applyMatrix4(object.matrixWorld)
              .project(camera);
            expect(Math.abs(point.x)).toBeLessThan(1 - 24 / width);
            expect(Math.abs(point.y)).toBeLessThan(1 - 24 / height);
          }
        });
      }
    });
  }

  it("keeps the wide desktop pose at its original size", () => {
    const { satellites, choreography } = setup(1920, 1080 - 5.3 * 16);
    choreography.apply(1, 1920, 1080 - 5.3 * 16);
    expect(satellites[0].rig.scale.x).toBe(SATELLITE_RIG.tablet.scale);
    expect(satellites[0].rig.position.x).toBe(-27.5);
    expect(satellites[1].rig.scale.x).toBe(SATELLITE_RIG.phone.scale);
    expect(satellites[1].rig.position.x).toBe(25.5);
  });

  it("still exits satellites below their existing breakpoint", () => {
    const { satellites, choreography } = setup(1024, 800);
    choreography.apply(1, 1024, 800);
    for (const { rig } of satellites) {
      expect(rig.visible).toBe(false);
    }
  });

  it("preserves the closed pose and laptop at a fixed aspect", () => {
    const { camera, laptop, satellites, choreography } = setup(1920, 1000);
    choreography.apply(0, 1920, 1000);
    const closed = satellites.map(({ rig }) => rig.matrixWorld.clone());
    choreography.apply(0, 1440, 1000);
    for (const [index, { rig }] of satellites.entries()) {
      expect(rig.matrixWorld.equals(closed[index])).toBe(true);
    }
    choreography.apply(1, 1920, 1000);
    const laptopPose = laptop.matrixWorld.clone();
    const cameraPose = camera.position.clone();
    choreography.apply(1, 1536, 800);
    expect(laptop.matrixWorld.equals(laptopPose)).toBe(true);
    expect(camera.position.equals(cameraPose)).toBe(true);
  });
});
