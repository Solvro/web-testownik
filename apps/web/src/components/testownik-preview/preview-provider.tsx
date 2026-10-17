"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { EmbeddedSurfaceContext } from "@/components/ui/portal-container";
import type { EmbeddedSurface } from "@/components/ui/portal-container";
import { quizStatsKeys } from "@/hooks/use-quiz-stats";
import { cn } from "@/lib/utils";

import {
  PREVIEW_HOURLY,
  PREVIEW_QUIZ_ID,
  PREVIEW_SESSIONS,
  PREVIEW_TIMELINE,
} from "./preview-fixtures";

/**
 * Seeds a throwaway query cache with a small sample of the landing fixtures.
 *
 * The stats components on the marketing page are the same ones the app renders;
 * they fetch through react-query. Pre-filling the cache lets them mount and
 * render their real markup without a request, an API base URL or a session —
 * so the landing page shows the product rather than a drawing of it. The iPad
 * cannot switch scope, so only the visible queries and a few representative
 * points are retained.
 */
function createPreviewClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // Never considered stale, so nothing ever tries to refetch.
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
    },
  });

  const id = PREVIEW_QUIZ_ID;
  client.setQueryData(
    quizStatsKeys.timeline(id, "me", 30),
    PREVIEW_TIMELINE.slice(-7),
  );
  client.setQueryData(
    quizStatsKeys.sessions(id, "me", 30),
    PREVIEW_SESSIONS.slice(-4),
  );
  client.setQueryData(
    quizStatsKeys.hourly(id, "me"),
    PREVIEW_HOURLY.filter(({ hour }) => hour % 3 === 0),
  );

  return client;
}

export function PreviewDataProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  // The cache is built once per mount and never refetches, so a ref is a truer
  // fit than state: nothing here ever triggers a re-render.
  const clientReference = useRef<QueryClient | null>(null);
  clientReference.current ??= createPreviewClient();
  return (
    <QueryClientProvider client={clientReference.current}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Links inside a preview point at real app routes. Following one would leave
 * the landing page from inside a drawing of a device, so the click is
 * cancelled before `next/link` sees it (it skips prevented events) and before
 * the browser does.
 */
function cancelNavigation(event: MouseEvent<HTMLElement>): void {
  if (
    event.target instanceof Element &&
    event.target.closest("a[href]") !== null
  ) {
    event.preventDefault();
  }
}

/**
 * Turns whatever it wraps into a self-contained screen: the box is the
 * boundary for layout, paint, focus rings and fixed positioning, overlays
 * portal into a layer inside it (so a tooltip is clipped by the device and
 * follows its 3D transform), page-wide keyboard shortcuts only fire while
 * focus is inside, and links do not navigate.
 *
 * The containment is expressed with utilities here rather than on the scene's
 * screen hosts because the same surfaces also render in a plain CSS phone
 * frame; landing.css only adds the matching rules for the CSS3D hosts.
 */
export function PreviewSandbox({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
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
        "@container relative isolate size-full overflow-clip overscroll-contain [contain:layout_paint_style]",
        // A named view transition would lift a piece of the screen out of
        // the device during a page navigation.
        "**:[view-transition-name:none]!",
        className,
      )}
      onClickCapture={cancelNavigation}
      onAuxClickCapture={cancelNavigation}
    >
      <EmbeddedSurfaceContext value={surface}>
        {children}
      </EmbeddedSurfaceContext>
      <div
        ref={setPortalContainer}
        data-preview-portal=""
        className="pointer-events-none absolute inset-0 z-50 overflow-clip *:pointer-events-auto"
      />
    </div>
  );
}
