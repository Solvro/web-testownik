import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";
import type { Object3D } from "three";

import { isMesh } from "./utils";

/**
 * A painted contact shadow for the iPad.
 *
 * Its real cast shadow throws a long razor-edged triangle across the lid. A
 * compact soft blob follows the device far more convincingly while it rests on
 * the MacBook, and the choreography fades it out as the iPad lifts away.
 */
export function createTabletContactShadow({
  tablet,
  screenObject,
  screenHeightPx,
}: {
  tablet: Object3D;
  screenObject: Object3D;
  screenHeightPx: number;
}): MeshBasicMaterial {
  tablet.traverse((object) => {
    if (isMesh(object)) {
      object.castShadow = false;
    }
  });

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 176;
  const context = canvas.getContext("2d");
  if (context !== null) {
    context.filter = "blur(18px)";
    context.fillStyle = "rgb(0 0 0 / 72%)";
    context.beginPath();
    context.roundRect(30, 32, 196, 112, 22);
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const material = new MeshBasicMaterial({
    map: texture,
    opacity: 0.34,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    side: DoubleSide,
  });

  const mesh = new Mesh(
    new PlaneGeometry(780, screenHeightPx * 1.12),
    material,
  );
  mesh.position.z = -10;
  mesh.renderOrder = 1;
  screenObject.add(mesh);

  return material;
}
