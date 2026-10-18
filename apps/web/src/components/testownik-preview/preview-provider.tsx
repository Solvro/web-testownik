"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { EmbeddedSurfaceContext } from "@/components/ui/portal-container";
import type { EmbeddedSurface } from "@/components/ui/portal-container";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

import {
  createPreviewClient,
  createTabletClient,
  setActivePreviewToaster,
} from "./preview-client";

/**
 * What the real components inside a screen need instead of the app's
 * providers: a preview query cache (pass `client` to share one between the
 * screens of a session) and a toaster inside the screen for what the preview
 * services report. Render it inside a `PreviewSandbox` so the toaster stays
 * in the screen.
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
      <Toaster id={toasterId} position="bottom-center" />
    </QueryClientProvider>
  );
}

/** The tablet's charts, rendered from a cache seeded once per mount. */
export function PreviewDataProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  // Built once and never refetched; nothing about it ever re-renders.
  const clientReference = useRef<QueryClient | null>(null);
  clientReference.current ??= createTabletClient();
  return (
    <PreviewRuntime client={clientReference.current}>{children}</PreviewRuntime>
  );
}

/**
 * Links inside a preview point at real app routes. Following one would leave
 * the landing page from inside a drawing of a device, so the click is
 * cancelled before `next/link` sees it (it skips prevented events) and before
 * the browser does. The screen may still act on where it pointed.
 */
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
 * Turns whatever it wraps into a self-contained screen: the box is the
 * boundary for layout, paint, focus rings and fixed positioning, overlays
 * portal into a layer inside it (so a tooltip is clipped by the device and
 * follows its 3D transform), page-wide keyboard shortcuts only fire while
 * focus is inside, and links do not navigate — `onNavigate` receives their
 * `href` instead, which is how a screen switches views.
 *
 * The box itself does not scroll. A screen that does keeps the browser's
 * default scroll chaining, so at the end of its list the page carries on;
 * landing.css contains it only for the 3D scene's screen hosts.
 *
 * The containment is expressed with utilities here rather than on the scene's
 * screen hosts because the same surfaces also render in a plain CSS phone
 * frame; landing.css only adds the matching rules for the CSS3D hosts.
 */
export function PreviewSandbox({
  children,
  className,
  onNavigate,
}: {
  children: ReactNode;
  className?: string;
  onNavigate?: (href: string) => void;
}): React.JSX.Element {
  // Elements in state rather than refs: the context must update once they
  // attach so portals that opened early move into the screen.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const surface: EmbeddedSurface = { root, portalContainer };

  return (
    <div
      ref={setRoot}
      data-preview-sandbox=""
      className={cn(
        // `contain: paint` and the container query make this box the
        // containing block for `position: fixed`, so dialog backdrops cover
        // the screen and not the page.
        "@container relative isolate size-full overflow-clip [contain:layout_paint_style]",
        // A named view transition would lift a piece of the screen out of
        // the device during a page navigation.
        "**:[view-transition-name:none]!",
        // Dialogs size themselves against the viewport (`dvh`, `sm:`); in a
        // screen the screen is the bound.
        "**:data-[slot=alert-dialog-content]:max-h-[calc(100%-2rem)]! **:data-[slot=alert-dialog-content]:overflow-y-auto **:data-[slot=dialog-content]:max-h-[calc(100%-2rem)]!",
        "@max-lg:**:data-[slot=alert-dialog-content]:max-w-[calc(100%-1.5rem)]! @max-lg:**:data-[slot=dialog-content]:max-w-[calc(100%-1.5rem)]!",
        className,
      )}
      onClickCapture={(event) => {
        cancelNavigation(event, onNavigate);
      }}
      onAuxClickCapture={(event) => {
        cancelNavigation(event);
      }}
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
