/** Keep the scene alive through ordinary GPU resets before releasing it. */
export const CONTEXT_RESTORE_MS = 15_000;

/** Creation failures are terminal for one scene; a desktop remount may retry. */
export type WebGLAvailability =
  | "available"
  | "lost"
  | "expired"
  | "unavailable";
export type WebGLEvent = "lost" | "restored" | "timeout" | "failed";
export type WebGLUnavailableReason = "creation-failed" | "context-timeout";

export function nextWebGLAvailability(
  state: WebGLAvailability,
  event: WebGLEvent,
): WebGLAvailability {
  if (state === "unavailable" || event === "failed") {
    return "unavailable";
  }
  if (event === "lost") {
    return state === "expired" ? state : "lost";
  }
  if (event === "restored") {
    return "available";
  }
  return state === "lost" ? "expired" : state;
}

/** Context creation can return null or throw (for example, a browser policy). */
export function tryWebGLContext<T>(create: () => T | null): T | null {
  try {
    return create();
  } catch {
    return null;
  }
}

/** Share the failure budget and warning across desktop remounts on this page. */
export function createWebGLRetryPolicy(): {
  canAttempt: () => boolean;
  recordFailure: (reason: WebGLUnavailableReason) => boolean;
} {
  let creationFailures = 0;
  let hasWarned = false;
  return {
    canAttempt: () => creationFailures < 2,
    recordFailure: (reason) => {
      if (reason === "creation-failed") {
        creationFailures += 1;
      }
      const shouldWarn = !hasWarned;
      hasWarned = true;
      return shouldWarn;
    },
  };
}

export const heroWebGLRetryPolicy = createWebGLRetryPolicy();
