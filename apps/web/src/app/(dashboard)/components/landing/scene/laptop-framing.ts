import { SCENE_WIDTH } from "../breakpoints";

/**
 * Shared framing maths for the hero MacBook.
 *
 * Both the live three.js scene and the static loading cover need to agree on
 * exactly where the laptop lands on screen, otherwise the hand-off between them
 * visibly jumps. Keeping the solve here — as plain arithmetic over the asset's
 * measured bounds — means there is only one implementation to be right.
 */

type Corner = readonly [number, number, number];

/**
 * Axis-aligned bounds of the model, measured once from
 * `macbook-pro-14-space-black.usdz` with the lid at each end of its travel.
 * The closed box is deeper than the visible laptop because the hinge barrel
 * swings below the base; that padding is harmless as long as both consumers
 * use the same numbers.
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

/** Lid travel from open to shut, in degrees. */
export const LID_TRAVEL_DEGREES = 111;

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
  const { target, distance, pitch, fov } = framing;
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
  const half = Math.tan(toRadians(fov) / 2);
  return {
    x: view[0] / depth / (half * aspect),
    y: up / depth / half,
  };
}

export function frameLaptop({
  opening,
  aspect,
  compact,
  withSatellites,
}: {
  opening: number;
  aspect: number;
  compact: boolean;
  withSatellites: boolean;
}): { framing: Framing; corners: Corner[] } {
  const corners = poseCorners(opening);
  const target: [number, number, number] = [0, 0, 0];
  for (const corner of corners) {
    target[0] += corner[0] / corners.length;
    target[1] += corner[1] / corners.length;
    target[2] += corner[2] / corners.length;
  }

  const fov = compact ? 34 : 30;
  // Closed is viewed from a low three-quarter angle, not from overhead: the
  // wedge profile and the lid edge are what make it read as a laptop at all.
  // Straight down it is just a dark rectangle.
  const pitch = toRadians(lerp(compact ? 46 : 38, compact ? 13 : 10, opening));
  // Closed reads at a similar size to open without swallowing the frame. The
  // measured box is deeper when shut (the hinge barrel swings below the base),
  // so the same number here yields a visually smaller device.
  const fill = lerp(compact ? 0.66 : 0.7, withSatellites ? 0.72 : 0.9, opening);

  // Converge on the tightest distance that still keeps every corner inside.
  let distance = 90;
  for (let pass = 0; pass < 3; pass += 1) {
    const framing: Framing = { target, distance, pitch, fov };
    let extent = 0;
    for (const corner of corners) {
      const point = project(corner, framing, aspect);
      extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
    }
    distance *= extent / fill;
  }

  // Panning eye and target together shifts the subject in frame without
  // distorting the perspective, leaving headline room while closed.
  const panned: [number, number, number] = [
    target[0],
    target[1] + lerp(distance * 0.12, 0, opening),
    target[2],
  ];

  return { framing: { target: panned, distance, pitch, fov }, corners };
}

/** Screen-space box the posed laptop occupies, in CSS pixels. */
export function laptopScreenRect(
  width: number,
  height: number,
  opening = 0,
): ScreenRect {
  const aspect = width / height;
  const { framing, corners } = frameLaptop({
    opening,
    aspect,
    compact: width < SCENE_WIDTH.compact,
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
