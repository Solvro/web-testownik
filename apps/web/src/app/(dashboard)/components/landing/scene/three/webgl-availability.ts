/** A failed scene stays static for its lifetime; scrolling never retries it. */
export type WebGLAvailability = "available" | "lost" | "unavailable";
export type WebGLEvent = "lost" | "restored" | "timeout";

export function nextWebGLAvailability(
  state: WebGLAvailability,
  event: WebGLEvent,
): WebGLAvailability {
  if (state === "unavailable") {
    return state;
  }
  if (event === "lost") {
    return "lost";
  }
  if (event === "restored") {
    return "available";
  }
  return state === "lost" ? "unavailable" : state;
}

/** Context creation can return null or throw (for example, a browser policy). */
export function tryWebGLContext<T>(create: () => T | null): T | null {
  try {
    return create();
  } catch {
    return null;
  }
}
