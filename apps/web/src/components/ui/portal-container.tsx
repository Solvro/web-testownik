"use client";

import { createContext, use } from "react";

/**
 * A bounded box that renders app components, such as a live preview of a
 * screen inside another page. Inside one, the wrappers in `components/ui`
 * portal into `portalContainer`, so overlays are clipped by the box, follow its
 * transforms and never cover the surrounding page. Outside, the context is
 * `null` and nothing changes.
 */
export interface EmbeddedSurface {
  /** Events and focus outside it do not belong to the surface. */
  root: HTMLElement | null;
  /** Where overlays mount. `null` while it is still being attached. */
  portalContainer: HTMLElement | null;
  /**
   * Default `modal` for dialogs and menus inside the surface, as in Base UI's
   * Dialog. An explicit prop wins; menus treat `"trap-focus"` as `false`.
   */
  modal?: boolean | "trap-focus";
}

export const EmbeddedSurfaceContext = createContext<EmbeddedSurface | null>(
  null,
);

export function useEmbeddedSurface(): EmbeddedSurface | null {
  return use(EmbeddedSurfaceContext);
}

/**
 * The `container` for a Base UI `Portal`: `undefined` keeps the default
 * (`document.body`), `null` makes the portal wait for the surface to attach.
 */
export function usePortalContainer(): HTMLElement | null | undefined {
  const surface = use(EmbeddedSurfaceContext);
  return surface === null ? undefined : surface.portalContainer;
}

/** The surface's default `modal` for overlays, `undefined` if it sets none. */
export function useSurfaceModal(): boolean | "trap-focus" | undefined {
  return use(EmbeddedSurfaceContext)?.modal;
}

/**
 * Whether an event should reach a component's page-wide handlers, such as
 * keyboard shortcuts. Inside a surface only events from within it qualify.
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
