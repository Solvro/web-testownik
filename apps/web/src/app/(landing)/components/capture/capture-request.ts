/**
 * Parameters `scripts/capture-device-stack.mjs` uses to re-render the static
 * loading cover. Gated on `NODE_ENV`, so production never honours them.
 */
export interface CaptureRequest {
  loadingCover: boolean;
  /** 1–4. */
  pixelRatio?: number;
  background?: "black" | "green" | "white";
  theme?: "dark" | "light";
  /** 0 closed, 1 open. */
  progress?: number;
}

export interface LandingSearchParameters {
  capture?: string;
  captureBg?: "black" | "green" | "white";
  captureProgress?: string;
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
  const progress = Number.parseFloat(parameters.captureProgress ?? "");

  return {
    loadingCover: parameters.capture === "cover",
    pixelRatio: Number.isFinite(scale)
      ? Math.min(Math.max(scale, 1), 4)
      : undefined,
    background: parameters.captureBg,
    theme: parameters.captureTheme,
    progress: Number.isFinite(progress)
      ? Math.min(Math.max(progress, 0), 1)
      : undefined,
  };
}
