"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useMediaQuery } from "../../hooks/use-media-query";
import { LANDING_SECTIONS } from "../../landing-sections";
import type { LandingSectionId } from "../../landing-sections";
import {
  TOC_PREVIEW_GAP,
  TOC_PREVIEW_INNER_HEIGHT,
  attachTocPreviewHost,
  invalidateTocSectionPreviews,
  showTocSectionPreview,
  warmTocSectionPreviews,
} from "./toc-section-preview";

/** Peeks need a real hover and room beside the rail. */
const PREVIEW_QUERY =
  "(hover: hover) and (pointer: fine) and (min-width: 960px)";
/** Short grace period so moving between rail items does not flicker. */
const PREVIEW_HIDE_DELAY = 120;
/** Let a resize settle before rebuilding peeks against the new layout. */
const PREVIEW_REWARM_DELAY = 400;
/** `lp-toc-preview-boom` duration. */
const PREVIEW_BOOM_MS = 360;
/** Outer chrome: padding + screen + caption row. */
const PREVIEW_CARD_HEIGHT = TOC_PREVIEW_INNER_HEIGHT + 8 + 8 + 36;

export const TOC_PREVIEW_ATTRIBUTE = "data-landing-toc-preview";

/** `in` while shown, `out` while the leaving pop plays. */
export type TocPreviewMotion = "hidden" | "in" | "out";

export interface TocPreviewState {
  id: LandingSectionId | null;
  motion: TocPreviewMotion;
  top: number;
  left: number;
}

export type TocPreviewAction =
  | { type: "show"; id: LandingSectionId; top: number; left: number }
  | { type: "boom" }
  | { type: "hide" };

export const HIDDEN_TOC_PREVIEW: TocPreviewState = {
  id: null,
  motion: "hidden",
  top: 0,
  left: 0,
};

export function tocPreviewReducer(
  state: TocPreviewState,
  action: TocPreviewAction,
): TocPreviewState {
  switch (action.type) {
    case "show": {
      return {
        id: action.id,
        motion: "in",
        top: action.top,
        left: action.left,
      };
    }
    case "boom": {
      return state.id === null || state.motion === "out"
        ? state
        : { ...state, motion: "out" };
    }
    case "hide": {
      return state.id === null && state.motion === "hidden"
        ? state
        : { ...state, id: null, motion: "hidden" };
    }
  }
}

function clampPreviewTop(centerY: number): number {
  const half = PREVIEW_CARD_HEIGHT / 2;
  const min = half + 12;
  const max = window.innerHeight - half - 12;
  if (max <= min) {
    return window.innerHeight / 2;
  }
  return Math.min(max, Math.max(min, centerY));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The TOC's section peeks: warms them while idle, shows one beside a hovered
 * or focused link and pops it away on leave. The card is portalled, so a
 * pointer press outside both it and the rail dismisses it too.
 */
export function useTocPreview(
  navigationReference: React.RefObject<HTMLElement | null>,
): {
  enabled: boolean;
  preview: TocPreviewState;
  mountReference: React.RefObject<HTMLDivElement | null>;
  show: (id: LandingSectionId, anchor: HTMLElement) => void;
  scheduleHide: () => void;
  holdOpen: () => void;
  boom: () => void;
  hide: () => void;
} {
  const enabled = useMediaQuery(PREVIEW_QUERY);
  const mountReference = useRef<HTMLDivElement>(null);
  // Timers and window listeners read the state between renders, so it lives
  // in a ref and is mirrored into React state for rendering.
  const stateReference = useRef(HIDDEN_TOC_PREVIEW);
  const [state, setState] = useState(HIDDEN_TOC_PREVIEW);
  // The hide delay and the boom never overlap, so one timer serves both.
  const timer = useRef(0);

  const dispatch = (action: TocPreviewAction): void => {
    const next = tocPreviewReducer(stateReference.current, action);
    if (next !== stateReference.current) {
      stateReference.current = next;
      setState(next);
    }
  };

  const clearTimer = (): void => {
    if (timer.current !== 0) {
      window.clearTimeout(timer.current);
      timer.current = 0;
    }
  };

  const hide = (): void => {
    clearTimer();
    dispatch({ type: "hide" });
  };

  const boom = (): void => {
    const current = stateReference.current;
    if (current.id === null || current.motion === "out") {
      return;
    }
    clearTimer();
    if (prefersReducedMotion()) {
      dispatch({ type: "hide" });
      return;
    }
    dispatch({ type: "boom" });
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      dispatch({ type: "hide" });
    }, PREVIEW_BOOM_MS);
  };

  // Peeks are pre-built during idle, so showing one is only a mount: reveal
  // on the same event. This also lets a returning cursor interrupt a boom.
  const show = (id: LandingSectionId, anchor: HTMLElement): void => {
    if (!enabled) {
      return;
    }
    clearTimer();
    const linkRect = anchor.getBoundingClientRect();
    const navRect = navigationReference.current?.getBoundingClientRect();
    // Keep the peek clear of labels while their width animates on hover.
    const railRight = Math.max(navRect?.right ?? 0, 12 * 16);
    dispatch({
      type: "show",
      id,
      left: railRight + TOC_PREVIEW_GAP,
      top: clampPreviewTop(linkRect.top + linkRect.height / 2),
    });
  };

  const scheduleHide = (): void => {
    clearTimer();
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      boom();
    }, PREVIEW_HIDE_DELAY);
  };

  /** The pointer reached the card: keep it, unless it is already leaving. */
  const holdOpen = (): void => {
    if (stateReference.current.motion !== "out") {
      clearTimer();
    }
  };

  const hideOnDisable = useEffectEvent(hide);
  const boomOnOutsidePress = useEffectEvent(boom);
  const clearOnUnmount = useEffectEvent(clearTimer);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelWarm: (() => void) | null = null;
    let rewarmTimer = 0;

    const warm = (): void => {
      cancelWarm?.();
      cancelWarm = warmTocSectionPreviews(LANDING_SECTIONS);
    };
    const drop = (): void => {
      cancelWarm?.();
      cancelWarm = null;
      invalidateTocSectionPreviews();
    };
    // Resizes change the layout; theme switches change the cloned icons.
    const rebuild = (): void => {
      drop();
      window.clearTimeout(rewarmTimer);
      rewarmTimer = window.setTimeout(warm, PREVIEW_REWARM_DELAY);
    };
    const themeObserver = new MutationObserver(rebuild);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const handlePageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) {
        warm();
      }
    };

    // After `load`, so warming never competes with the hero's own boot.
    if (document.readyState === "complete") {
      warm();
    } else {
      window.addEventListener("load", warm, { once: true });
    }
    window.addEventListener("resize", rebuild);
    window.addEventListener("pagehide", drop);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("load", warm);
      window.removeEventListener("resize", rebuild);
      window.removeEventListener("pagehide", drop);
      window.removeEventListener("pageshow", handlePageShow);
      themeObserver.disconnect();
      window.clearTimeout(rewarmTimer);
      drop();
      hideOnDisable();
    };
  }, [enabled]);

  useLayoutEffect(() => {
    const mount = mountReference.current;
    if (!enabled || mount === null) {
      return;
    }
    return attachTocPreviewHost(mount);
  }, [enabled]);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    showTocSectionPreview(
      LANDING_SECTIONS.find((section) => section.id === state.id) ?? null,
    );
  }, [enabled, state.id]);

  const isShown = state.id !== null && state.motion !== "out";
  useEffect(() => {
    if (!isShown) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (navigationReference.current?.contains(target) === true) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest(`[${TOC_PREVIEW_ATTRIBUTE}]`) !== null
      ) {
        return;
      }
      boomOnOutsidePress();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isShown, navigationReference]);

  useEffect(() => {
    return () => {
      clearOnUnmount();
    };
  }, []);

  return {
    enabled,
    preview: enabled ? state : HIDDEN_TOC_PREVIEW,
    mountReference,
    show,
    scheduleHide,
    holdOpen,
    boom,
    hide,
  };
}
