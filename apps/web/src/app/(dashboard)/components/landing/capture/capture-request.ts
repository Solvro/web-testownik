/**
 * Development-only capture harness.
 *
 * `scripts/capture-device-stack.mjs` drives the hero with these parameters to
 * re-render the static loading cover from the live model. It is gated on
 * `NODE_ENV` so none of it can be triggered in production.
 */
export interface CaptureRequest {
  /** Freeze the scene on the static cover instead of the live model. */
  loadingCover: boolean;
  /** Device pixel ratio the WebGL renderer should use, 1–4. */
  pixelRatio?: number;
  background?: "black" | "green" | "white";
  theme?: "dark" | "light";
}

export interface LandingSearchParameters {
  capture?: string;
  captureBg?: "black" | "green" | "white";
  captureScale?: string;
  captureTheme?: "dark" | "light";
  landing?: string;
}

/** Explicitly opens the landing page instead of the signed-in dashboard. */
export function isLandingRequest(parameters: LandingSearchParameters): boolean {
  return parameters.landing === "true";
}

export function parseCaptureRequest(
  parameters: LandingSearchParameters,
): CaptureRequest | null {
  if (process.env.NODE_ENV !== "development" || !isLandingRequest(parameters)) {
    return null;
  }
  if (parameters.capture !== "devices" && parameters.capture !== "cover") {
    return null;
  }

  const scale = Number.parseFloat(parameters.captureScale ?? "");

  return {
    loadingCover: parameters.capture === "cover",
    pixelRatio: Number.isFinite(scale)
      ? Math.min(Math.max(scale, 1), 4)
      : undefined,
    background: parameters.captureBg,
    theme: parameters.captureTheme,
  };
}
