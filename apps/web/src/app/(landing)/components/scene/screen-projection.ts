import { createContext } from "react";

import type { ScreenDevice } from "./screen-frame-protocol";
import type { ClientPoint } from "./three/create-device-stack";

/**
 * Maps a point in a screen's iframe to page client coordinates through the 3D
 * stack as last rendered. False while the stack is not built or the point is
 * behind the camera.
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
