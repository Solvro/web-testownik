/**
 * `/models/*` is cached as immutable, so bump `v` whenever
 * `pnpm export:device-models` regenerates the file. Its own module so the
 * hero's preload link does not pull in three.js.
 */
export const DEVICE_MODELS_URL = "/models/device-stack.glb?v=1";
