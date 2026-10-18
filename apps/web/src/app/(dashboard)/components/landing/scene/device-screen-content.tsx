"use client";

import { BatteryFull, Search, Wifi } from "lucide-react";
import { Suspense, lazy, useState } from "react";

import { PreviewSandbox } from "@/components/testownik-preview/preview-provider";
import type { PreviewQuizSession } from "@/components/testownik-preview/preview-session";
import {
  PhoneQuizSurface,
  ProductAppChrome,
} from "@/components/testownik-preview/product-surfaces";
import { cn } from "@/lib/utils";

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
