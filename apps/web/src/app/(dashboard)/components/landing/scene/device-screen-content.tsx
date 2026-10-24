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
import { EmbeddedSurfaceContext } from "@/components/ui/portal-container";
import { cn } from "@/lib/utils";

import { useSupportsHtmlInCanvas } from "../hooks/use-html-in-canvas";
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
 *
 * Without html-in-canvas (Safari, Firefox, Chrome without the origin trial)
 * or when WebGL2 fails, there is no lens at all: the screen renders its
 * children directly, never through Glass. The server and the hydration pass
 * render that plain screen too.
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
 * The box html-in-canvas captures, declared as an embedded surface so the
 * screen's menus and dialogs portal into it instead of the frame's body.
 * Outside the captured subtree an open menu was invisible to the lens and,
 * being outside the content element, counted as the pointer leaving it, so
 * the lens vanished the moment a menu or dialog opened. `contain: paint`
 * makes this box the containing block for the dialogs' fixed backdrops.
 *
 * Glass renders its children twice while the first capture is pending (the
 * live copy and a visible stand-in), so the surface state lives here, per
 * copy, rather than in GlassScreen.
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
      <EmbeddedSurfaceContext value={{ root, portalContainer }}>
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
