"use client";

import { Suspense, lazy, useState } from "react";

import { PreviewSandbox } from "@/components/testownik-preview/preview-provider";
import type { PreviewQuizSession } from "@/components/testownik-preview/preview-session";
import {
  PhoneQuizSurface,
  ProductAppChrome,
} from "@/components/testownik-preview/product-surfaces";
import { cn } from "@/lib/utils";

import { LaptopMenuBar } from "./laptop-menu-bar";

/**
 * What each desktop device screen renders inside its iframe (see
 * `screen-frame-document.tsx`). The frame is the screen, at its native size,
 * so these lay out as the app does on a device that wide.
 */

const TabletLiveCharts = lazy(async () => {
  const loaded = await import("./tablet-live-charts");
  return { default: loaded.TabletLiveCharts };
});

export interface DeviceQuizControls {
  /** The quiz the laptop and the iPhone both show. */
  session: PreviewQuizSession;
}

export function DeviceLaptopScreen({
  session,
}: DeviceQuizControls): React.JSX.Element {
  return (
    <div className="bg-background flex size-full flex-col">
      <LaptopMenuBar />
      <ProductAppChrome
        className="min-h-0 flex-1"
        session={session}
        standalone
      />
    </div>
  );
}

export function DeviceTabletScreen(): React.JSX.Element {
  const [showCharts, setShowCharts] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  // The charts are not a product surface of their own, so the screen cancels
  // their links here. They load on the visitor's first contact with the iPad.
  return (
    <PreviewSandbox standalone>
      <div
        className="relative size-full"
        onPointerEnter={() => {
          setShowCharts(true);
        }}
      >
        {/* Captured from the real seeded charts; refresh when their preview changes. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 bg-[url(/models/testownik-tablet-stats-preview-light.webp)] bg-size-[100%_100%] transition-opacity duration-150 dark:bg-[url(/models/testownik-tablet-stats-preview-dark.webp)]",
            chartsReady ? "opacity-0" : "opacity-100",
          )}
        />
        {showCharts ? (
          <Suspense fallback={null}>
            <TabletLiveCharts
              visible={chartsReady}
              onReady={() => {
                setChartsReady(true);
              }}
            />
          </Suspense>
        ) : null}
      </div>
    </PreviewSandbox>
  );
}

export function DevicePhoneScreen({
  session,
}: DeviceQuizControls): React.JSX.Element {
  return <PhoneQuizSurface session={session} standalone />;
}
