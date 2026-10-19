"use client";

import { Suspense, lazy, useState } from "react";
import type { ReactNode } from "react";

import { Glass } from "@/components/canvasui/Glass";
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

/**
 * The magnifier over the iPad and the iPhone. html-in-canvas only reaches
 * into its own document, which is why it lives in the frame rather than
 * around it, and why the pointer it follows is the frame's own, flat one.
 *
 * Glass runs its own WebGL loop per instance. The magnifier is only needed once
 * the visitor is actually pointing at a device screen, so the effect stays off
 * until first contact and then remains mounted for that surface. That also
 * keeps it out of the loading covers, which are captured untouched.
 * (Shrinking the hero Bubble on hover is the page's job; the frame element
 * sees the same enter and leave.)
 */
function GlassScreen({
  children,
  targets,
  onFirstEngage,
}: {
  children: ReactNode;
  targets?: string;
  onFirstEngage?: () => void;
}): React.JSX.Element {
  const [engaged, setEngaged] = useState(false);

  return (
    <div
      className="relative isolate size-full overflow-hidden"
      onPointerEnter={() => {
        if (!engaged) {
          setEngaged(true);
          onFirstEngage?.();
        }
      }}
    >
      {engaged ? (
        <Glass
          // CanvasUI appends the output canvas after the content it refracts.
          className="size-full [&>canvas:last-child]:z-4"
          size={60}
          targets={targets}
        >
          {children}
        </Glass>
      ) : (
        children
      )}
    </div>
  );
}

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
      <GlassScreen
        onFirstEngage={() => {
          setShowCharts(true);
        }}
      >
        <div className="relative size-full">
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
      </GlassScreen>
    </PreviewSandbox>
  );
}

export function DevicePhoneScreen({
  session,
}: DeviceQuizControls): React.JSX.Element {
  return (
    <GlassScreen targets="button, [data-slot=card-title]">
      <PhoneQuizSurface session={session} standalone />
    </GlassScreen>
  );
}
