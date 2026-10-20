"use client";

import { createContext, use } from "react";

/**
 * A surface that renders the app's components inside a bounded box rather than
 * as the page — the device screens on the landing page are the case in point.
 *
 * Outside such a surface nothing changes: the context is `null`, overlays
 * portal to `document.body` and keep their usual modality. Inside one, the
 * wrappers in `components/ui` portal into `portalContainer` so tooltips, menus
 * and dialogs are clipped by the box, follow its transforms and never cover
 * the surrounding page.
 */
export interface EmbeddedSurface {
  /** The box itself. Events and focus outside it do not belong to the surface. */
  root: HTMLElement | null;
  /** Native layout of a CSS phone, independent of the outer viewport. */
  layout?: "phone";
  /** Where overlays mount. `null` while it is still being attached. */
  portalContainer: HTMLElement | null;
}

export const EmbeddedSurfaceContext = createContext<EmbeddedSurface | null>(
  null,
);

export function useEmbeddedSurface(): EmbeddedSurface | null {
  return use(EmbeddedSurfaceContext);
}

export function useIsPhoneSurface(): boolean {
  return useEmbeddedSurface()?.layout === "phone";
}

/**
 * The `container` for a Base UI `Portal`: `undefined` keeps the default
 * (`document.body`), `null` makes the portal wait for the surface to attach.
 */
export function usePortalContainer(): HTMLElement | null | undefined {
  const surface = use(EmbeddedSurfaceContext);
  return surface === null ? undefined : surface.portalContainer;
}

/**
 * Whether an event should reach page-wide handlers (keyboard shortcuts and
 * the like) registered by a component. Always true outside a surface; inside
 * one only events that originate within it qualify.
 */
export function isEventForSurface(
  surface: EmbeddedSurface | null,
  event: Event,
): boolean {
  if (surface === null) {
    return true;
  }
  const { target } = event;
  return (
    target instanceof Node &&
    (surface.root?.contains(target) === true ||
      surface.portalContainer?.contains(target) === true)
  );
}
