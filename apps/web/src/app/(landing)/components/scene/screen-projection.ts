import { createContext } from "react";

import type { ScreenDevice } from "./screen-frame-protocol";
import type { ClientPoint } from "./three/create-device-stack";

/**
 * Maps a point on a live screen (its iframe's client pixels) to the page's
 * client coordinates through the 3D stack, as last rendered. Returns false
 * while the stack is not built or the point is behind the camera.
 *
 * `DeviceStack` provides it around the screens it portals; the frames use it
 * to hand the pointer they capture back to the page (see
 * `device-screen-frame.tsx`).
 */
export type ProjectScreenPoint = (
  device: ScreenDevice,
  x: number,
  y: number,
  out: ClientPoint,
) => boolean;

const notBuilt: ProjectScreenPoint = () => false;

export const ScreenProjectionContext =
  createContext<ProjectScreenPoint>(notBuilt);
