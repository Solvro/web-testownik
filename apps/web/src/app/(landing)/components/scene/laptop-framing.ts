import { SCENE_WIDTH } from "../breakpoints";

/**
 * Framing for the hero MacBook, shared by the three.js scene and the static
 * loading cover so the hand-off between them does not jump.
 */

type Corner = readonly [number, number, number];

/**
 * Bounds of the MacBook in `public/models/device-stack.glb` at each end of the
 * lid's travel. The closed box is deeper than the visible laptop because the
 * hinge barrel swings below the base.
 */
export const CLOSED_CORNERS: readonly Corner[] = [
  [-15.632, -7.637, -11.353],
  [15.632, -7.637, -11.353],
  [-15.632, 7.783, -11.353],
  [15.632, 7.783, -11.353],
  [-15.632, -7.637, 11.173],
  [15.632, -7.637, 11.173],
  [-15.632, 7.783, 11.173],
  [15.632, 7.783, 11.173],
];

export const OPEN_CORNERS: readonly Corner[] = [
  [-15.632, -0.94, -19.018],
  [15.632, -0.94, -19.018],
  [-15.632, 20.262, -19.018],
  [15.632, 20.262, -19.018],
  [-15.632, -0.94, 11.06],
  [15.632, -0.94, 11.06],
  [-15.632, 20.262, 11.06],
  [15.632, 20.262, 11.06],
];

export const LID_TRAVEL_DEGREES = 111;

/** Vertical, in degrees. Narrower stages than `REFERENCE_ASPECT` widen it. */
export const CAMERA_FOV = 30;

/**
 * Aspect of the stage the closed cover was captured at. Narrower stages widen
 * the field of view rather than moving the camera back, which would change the
 * perspective; the cover then stays a uniform scale of the live render.
 */
export const REFERENCE_ASPECT = 1.758;

export interface Framing {
  target: [number, number, number];
  distance: number;
  pitch: number;
  fov: number;
}

export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

export function poseCorners(opening: number): Corner[] {
  return CLOSED_CORNERS.map((corner, index) => {
    const open = OPEN_CORNERS[index];
    return [
      lerp(corner[0], open[0], opening),
      lerp(corner[1], open[1], opening),
      lerp(corner[2], open[2], opening),
    ] as Corner;
  });
}

/**
 * Projects a point with the same conventions as a three.js `PerspectiveCamera`
 * that sits at `pitch` above the target and looks straight at it.
 */
function project(
  corner: Corner,
  framing: Framing,
  aspect: number,
): { x: number; y: number } {
  const { target, distance, pitch } = framing;
  const sin = Math.sin(pitch);
  const cos = Math.cos(pitch);
  const eye = [
    target[0],
    target[1] + sin * distance,
    target[2] + cos * distance,
  ];
  const view = [corner[0] - eye[0], corner[1] - eye[1], corner[2] - eye[2]];
  // Camera basis for a lookAt with world up: x = (1,0,0), y = (0,cos,-sin),
  // z = (0,sin,cos). three.js looks down -z, hence the negated depth.
  const up = view[1] * cos - view[2] * sin;
  const depth = -(view[1] * sin + view[2] * cos);
  const half = Math.tan(toRadians(framing.fov) / 2);
  return {
    x: view[0] / depth / (half * aspect),
    y: up / depth / half,
  };
}

export function frameLaptop({
  opening,
  aspect,
  withSatellites,
}: {
  opening: number;
  aspect: number;
  withSatellites: boolean;
}): { framing: Framing; corners: Corner[] } {
  const corners = poseCorners(opening);
  const target: [number, number, number] = [0, 0, 0];
  for (const corner of corners) {
    target[0] += corner[0] / corners.length;
    target[1] += corner[1] / corners.length;
    target[2] += corner[2] / corners.length;
  }

  // Closed is viewed from a low angle: straight down it is a dark rectangle.
  const pitch = toRadians(lerp(38, 10, opening));
  // The closed box is deeper (the hinge barrel), so the same fill reads smaller.
  const fill = lerp(0.7, withSatellites ? 0.72 : 0.9, opening);

  const maxExtent = (framing: Framing, forAspect: number): number => {
    let extent = 0;
    for (const corner of corners) {
      const point = project(corner, framing, forAspect);
      extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
    }
    return extent;
  };

  // The tightest distance that keeps every corner inside the reference stage.
  let distance = 90;
  for (let pass = 0; pass < 3; pass += 1) {
    const extent = maxExtent(
      { target, distance, pitch, fov: CAMERA_FOV },
      REFERENCE_ASPECT,
    );
    distance *= extent / fill;
  }

  const overflow =
    maxExtent({ target, distance, pitch, fov: CAMERA_FOV }, aspect) / fill;
  const fov =
    overflow > 1
      ? (2 * Math.atan(Math.tan(toRadians(CAMERA_FOV) / 2) * overflow) * 180) /
        Math.PI
      : CAMERA_FOV;

  // Panning eye and target together shifts the subject in frame without
  // distorting the perspective, leaving headline room while closed.
  const panned: [number, number, number] = [
    target[0],
    target[1] + lerp(distance * 0.12, 0, opening),
    target[2],
  ];

  return { framing: { target: panned, distance, pitch, fov }, corners };
}

export function laptopScreenRect(
  width: number,
  height: number,
  opening = 0,
): ScreenRect {
  const aspect = width / height;
  const { framing, corners } = frameLaptop({
    opening,
    aspect,
    withSatellites: width >= SCENE_WIDTH.satellites,
  });

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const corner of corners) {
    const point = project(corner, framing, aspect);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return {
    left: ((minX + 1) / 2) * width,
    top: ((1 - maxY) / 2) * height,
    width: ((maxX - minX) / 2) * width,
    height: ((maxY - minY) / 2) * height,
  };
}
