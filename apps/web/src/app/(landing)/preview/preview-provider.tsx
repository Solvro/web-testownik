"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { EmbeddedSurfaceContext } from "@/components/ui/portal-container";
import type { EmbeddedSurface } from "@/components/ui/portal-container";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import { PHONE_SURFACE_LAYOUT } from "./phone-surface-layout";
import {
  createPreviewClient,
  createTabletClient,
  setActivePreviewToaster,
} from "./preview-client";

/**
 * Stands in for the app's providers: a preview query cache (pass `client` to
 * share one) and an in-screen toaster. Render it inside a `PreviewSandbox`.
 */
export function PreviewRuntime({
  client,
  toasterId: screenToasterId,
  children,
}: {
  client?: QueryClient;
  /** Lets the screen post to the same in-screen toaster. */
  toasterId?: string;
  children: ReactNode;
}): React.JSX.Element {
  const ownToasterId = useId();
  const toasterId = screenToasterId ?? ownToasterId;
  const ownClient = useRef<QueryClient | null>(null);
  ownClient.current ??= client ?? createPreviewClient();
  const queryClient = client ?? ownClient.current;
  setActivePreviewToaster(queryClient, toasterId, { onlyIfUnset: true });
  const claim = (): void => {
    setActivePreviewToaster(queryClient, toasterId);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {/* React events bubble out of portals, so dialogs claim it too. */}
      <div
        className="contents"
        onPointerDownCapture={claim}
        onKeyDownCapture={claim}
      >
        {children}
      </div>
      <Toaster
        id={toasterId}
        position="bottom-center"
        containerAriaLabel={`Powiadomienia podglądu ${toasterId}`}
      />
    </QueryClientProvider>
  );
}

export function PreviewDataProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const clientReference = useRef<QueryClient | null>(null);
  clientReference.current ??= createTabletClient();
  return (
    <PreviewRuntime client={clientReference.current}>{children}</PreviewRuntime>
  );
}

/** Cancelled before `next/link` sees it, since it skips prevented events. */
function cancelNavigation(
  event: MouseEvent<HTMLElement>,
  onNavigate?: (href: string) => void,
): void {
  const link =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>("a[href]")
      : null;
  if (link === null) {
    return;
  }
  event.preventDefault();
  const href = link.getAttribute("href");
  if (href !== null && event.type === "click") {
    onNavigate?.(href);
  }
}

/**
 * A self-contained screen: the box bounds layout, paint and fixed
 * positioning, overlays portal inside it, page-wide shortcuts only fire while
 * focus is inside, and links call `onNavigate` instead of navigating.
 *
 * `standalone` is for a screen that is its own document (the desktop hero's
 * iframes), where the box only cancels links. A `layout="phone"` screen keeps
 * its own portal layer even then, so `PHONE_SURFACE_LAYOUT` reaches overlays.
 */
export function PreviewSandbox({
  children,
  className,
  onNavigate,
  standalone = false,
  layout,
}: {
  children: ReactNode;
  className?: string;
  onNavigate?: (href: string) => void;
  standalone?: boolean;
  layout?: "phone";
}): React.JSX.Element {
  // Elements in state rather than refs: the context must update once they
  // attach so portals that opened early move into the screen.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );
  // Overlays keep focus inside the screen but never lock the page's scroll
  // or block the pointer outside it.
  const surface: EmbeddedSurface = {
    root,
    portalContainer,
    modal: "trap-focus",
  };
  const isPhone = layout === "phone";
  const linkHandlers = {
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      cancelNavigation(event, onNavigate);
    },
    onAuxClickCapture: (event: MouseEvent<HTMLElement>) => {
      cancelNavigation(event);
    },
  };

  if (standalone && !isPhone) {
    return (
      <div
        data-preview-sandbox=""
        className={cn("relative size-full", className)}
        {...linkHandlers}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={setRoot}
      data-preview-sandbox=""
      className={cn(
        standalone
          ? "relative size-full"
          : [
              // `contain: paint` and the container query make this box the
              // containing block for `position: fixed`, so dialog backdrops
              // cover the screen and not the page.
              "@container relative isolate size-full overflow-clip [contain:layout_paint_style]",
              // A named view transition would lift a piece of the screen out
              // of the device during a page navigation.
              "**:[view-transition-name:none]!",
              // Dialogs size themselves against the viewport (`dvh`, `sm:`);
              // in a screen the screen is the bound.
              "**:data-[slot=alert-dialog-content]:overflow-y-auto",
              isPhone
                ? "**:data-[slot=alert-dialog-content]:max-h-[85%]! **:data-[slot=alert-dialog-content]:max-w-[calc(100%-2rem)]! **:data-[slot=dialog-content]:max-h-[85%]! **:data-[slot=dialog-content]:max-w-[calc(100%-2rem)]!"
                : "**:data-[slot=alert-dialog-content]:max-h-[calc(100%-2rem)]! **:data-[slot=dialog-content]:max-h-[calc(100%-2rem)]! @max-lg:**:data-[slot=alert-dialog-content]:max-w-[calc(100%-1.5rem)]! @max-lg:**:data-[slot=dialog-content]:max-w-[calc(100%-1.5rem)]!",
            ],
        isPhone && PHONE_SURFACE_LAYOUT,
        className,
      )}
      {...linkHandlers}
    >
      <EmbeddedSurfaceContext value={surface}>
        {children}
      </EmbeddedSurfaceContext>
      <div
        ref={setPortalContainer}
        data-preview-portal=""
        // Tooltips stay click-through: in a transformed screen they can land
        // on top of the button they describe and swallow its click.
        className="pointer-events-none absolute inset-0 z-50 overflow-clip *:pointer-events-auto *:has-data-[slot=tooltip-content]:pointer-events-none"
      />
    </div>
  );
}
