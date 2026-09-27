"use client";

import { useLayoutEffect } from "react";

import { cn } from "@/lib/utils";

import { landingFontVariables } from "../landing-fonts";
import "../landing.css";
import { DeviceScene } from "../scene/device-scene";
import "./capture-document.css";
import type { CaptureRequest } from "./capture-request";

const CAPTURE_DOCUMENT_CLASS = "device-capture-document";

/**
 * Renders the device stack alone, on a known background, for
 * `scripts/capture-device-stack.mjs`. Never reachable outside development —
 * see `parseCaptureRequest`.
 */
export function DeviceCapture({
  request,
}: {
  request: CaptureRequest;
}): React.JSX.Element {
  const { theme } = request;

  useLayoutEffect(() => {
    const { documentElement, body } = document;
    const wasDark = documentElement.classList.contains("dark");

    documentElement.classList.toggle("dark", theme === "dark");
    documentElement.classList.add(CAPTURE_DOCUMENT_CLASS);
    body.classList.add(CAPTURE_DOCUMENT_CLASS);

    return () => {
      documentElement.classList.toggle("dark", wasDark);
      documentElement.classList.remove(CAPTURE_DOCUMENT_CLASS);
      body.classList.remove(CAPTURE_DOCUMENT_CLASS);
    };
  }, [theme]);

  return (
    <div
      data-device-capture
      className={cn(
        // Above everything, transparent by default so the capture can be
        // trimmed to the device silhouette.
        "fixed inset-0 z-[2147483647] overflow-hidden bg-transparent [--landing-hero-progress:0]",
        request.background === "black" && "bg-black",
        request.background === "green" && "bg-[#0f0]",
        request.background === "white" && "bg-white",
        theme === "dark" && "dark",
        landingFontVariables,
      )}
    >
      {/* Matches the real hero's device-layer box, minus the navigation. */}
      <div className="absolute inset-x-0 top-[5.3rem] bottom-0">
        <DeviceScene
          captureMode
          captureLoadingCover={request.loadingCover}
          capturePixelRatio={request.pixelRatio}
        />
      </div>
    </div>
  );
}
