/**
 * The device model, versioned in the query so `/models/*` can be cached as
 * immutable (see `next.config.ts`). Bump `v` whenever
 * `pnpm export:device-models` regenerates the file; the covers carry their
 * version in the file name instead.
 *
 * Its own module so the hero's preload link can share it without pulling
 * three.js into the page bundle.
 */
export const DEVICE_MODELS_URL = "/models/device-stack.glb?v=1";
