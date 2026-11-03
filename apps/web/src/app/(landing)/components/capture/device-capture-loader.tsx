"use client";

import { Suspense, lazy } from "react";

import type { CaptureRequest } from "./capture-request";

// `lazy` keeps the harness and its device scene out of the page's initial chunks.
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
