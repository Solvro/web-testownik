"use client";

import { BatteryFull, Search, Wifi } from "lucide-react";
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

import { setSatelliteHovered } from "../satellite-hover";
import { SCENE_CLASS } from "./scene-classes";

const TabletLiveCharts = lazy(async () => {
  const loaded = await import("./tablet-live-charts");
  return { default: loaded.TabletLiveCharts };
});

/**
 * Glass runs its own WebGL loop per instance. The magnifier is only needed once
 * the visitor is actually pointing at a device screen, so the effect stays off
 * until first contact and then remains mounted for that surface.
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
        setEngaged(true);
        setSatelliteHovered(true);
        if (!engaged) {
          onFirstEngage?.();
        }
      }}
      onPointerLeave={() => {
        setSatelliteHovered(false);
      }}
    >
      {engaged ? (
        <Glass
          className={cn("size-full", SCENE_CLASS.deviceGlass)}
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

const MENU_BAR_ITEMS = ["Plik", "Edycja", "Widok", "Okno", "Pomoc"] as const;

/**
 * A slim macOS-style menu bar. It is as tall as the notch drawn by
 * `.lp-screen-laptop::after`, so the app below starts clear of it, exactly as
 * on a real notched MacBook.
 */
function LaptopMenuBar(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="text-foreground/80 flex h-[22px] shrink-0 items-center justify-between px-4 text-[11px] leading-none select-none"
    >
      <div className="flex items-center gap-4">
        <span className="text-foreground font-bold">Testownik</span>
        {MENU_BAR_ITEMS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="flex items-center gap-3 tabular-nums">
        <Wifi className="size-3" strokeWidth={2.4} />
        <BatteryFull className="size-3.5" strokeWidth={2} />
        <Search className="size-3" strokeWidth={2.4} />
        <span>pt. 9:41</span>
      </div>
    </div>
  );
}

export function DeviceLaptopScreen({
  session,
}: DeviceQuizControls): React.JSX.Element {
  return (
    <div className="bg-background flex flex-col">
      <LaptopMenuBar />
      <ProductAppChrome className="min-h-0 flex-1" session={session} />
    </div>
  );
}

export function DeviceTabletScreen(): React.JSX.Element {
  const [showCharts, setShowCharts] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);

  // The charts are not a product surface of their own, so the screen seals
  // them here.
  return (
    <PreviewSandbox>
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
  withGlass = true,
}: DeviceQuizControls & {
  withGlass?: boolean;
}): React.JSX.Element {
  const surface = <PhoneQuizSurface session={session} />;

  // The surface seals itself; see `PreviewSandbox`.
  if (!withGlass) {
    return surface;
  }

  return (
    <GlassScreen targets="button, [data-slot=card-title]">
      {surface}
    </GlassScreen>
  );
}
