"use client";

import { Suspense, lazy, useState } from "react";
import type { ReactNode } from "react";

import { Glass } from "@/app/(landing)/canvasui/glass";
import { PreviewSandbox } from "@/app/(landing)/preview/preview-provider";
import type { PreviewQuizSession } from "@/app/(landing)/preview/preview-session";
import {
  PhoneQuizSurface,
  ProductAppChrome,
} from "@/app/(landing)/preview/product-surfaces";
import { EmbeddedSurfaceContext } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

import { useSupportsHtmlInCanvas } from "../hooks/use-html-in-canvas";
import { LaptopMenuBar } from "./laptop-menu-bar";

const TabletLiveCharts = lazy(async () => {
  const loaded = await import("./tablet-live-charts");
  return { default: loaded.TabletLiveCharts };
});

/**
 * The magnifier over the iPad and the iPhone. It lives inside the frame
 * because html-in-canvas only reaches into its own document.
 *
 * Each Glass runs its own WebGL loop, so it mounts on first pointer contact
 * (which also keeps it out of the captured loading covers). Without
 * html-in-canvas or WebGL2 the screen renders its children directly.
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
  const supportsHtmlInCanvas = useSupportsHtmlInCanvas();
  const [isUnavailable, setIsUnavailable] = useState(false);
  const hasLens = engaged && supportsHtmlInCanvas && !isUnavailable;

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
      {hasLens ? (
        <Glass
          // CanvasUI appends the output canvas after the content it refracts.
          className="size-full [&>canvas:last-child]:z-4"
          size={60}
          targets={targets}
          onUnavailable={() => {
            setIsUnavailable(true);
          }}
        >
          <CapturedSurface>{children}</CapturedSurface>
        </Glass>
      ) : (
        children
      )}
    </div>
  );
}

/**
 * The box html-in-canvas captures, declared as an embedded surface so menus
 * and dialogs portal inside it. Outside it they are invisible to the lens and
 * count as the pointer leaving. `contain: paint` makes it the containing
 * block for the dialogs' fixed backdrops.
 *
 * Glass renders its children twice while the first capture is pending, so
 * the surface state lives here, per copy.
 */
function CapturedSurface({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );

  return (
    <div
      ref={setRoot}
      className="relative isolate size-full overflow-clip [contain:layout_paint_style]"
    >
      <EmbeddedSurfaceContext
        value={{ root, portalContainer, modal: "trap-focus" }}
      >
        {children}
      </EmbeddedSurfaceContext>
      <div
        ref={setPortalContainer}
        data-preview-portal=""
        className="pointer-events-none absolute inset-0 z-50 overflow-clip *:pointer-events-auto *:has-data-[slot=tooltip-content]:pointer-events-none"
      />
    </div>
  );
}

export interface DeviceQuizControls {
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
              "pointer-events-none absolute inset-0 bg-[url(/models/testownik-tablet-stats-preview-light-v1.webp)] bg-size-[100%_100%] transition-opacity duration-150 dark:bg-[url(/models/testownik-tablet-stats-preview-dark-v1.webp)]",
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
