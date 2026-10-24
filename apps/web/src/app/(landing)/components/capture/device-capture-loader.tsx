"use client";

import { Suspense, lazy } from "react";

import type { CaptureRequest } from "./capture-request";

/*
 * The page imports the capture harness unconditionally, and every client
 * component a page imports lands in its initial chunks. Going through `lazy`
 * keeps the harness, and the desktop device scene it renders, out of what
 * real visitors download.
 */
const DeviceCaptureHarness = lazy(async () => {
  const loaded = await import("./device-capture");
  return { default: loaded.DeviceCapture };
});

export function DeviceCapture({
  request,
}: {
  request: CaptureRequest;
}): React.JSX.Element {
  return (
    <Suspense fallback={null}>
      <DeviceCaptureHarness request={request} />
    </Suspense>
  );
}
