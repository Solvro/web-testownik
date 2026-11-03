/**
 * Builds the TOC peeks in idle time, keeps them parked in the card's shadow
 * root and current as the page changes, and reveals one on hover.
 */
import type { LandingSectionPeek } from "../../landing-sections";
import { ACTIVE_CLASS, buildPreview } from "./toc-preview-clone";
import type { PendingScroll } from "./toc-preview-clone";
import {
  TOC_PREVIEW_OBSERVED_ATTRIBUTES,
  TocPreviewFreshness,
  applyScrollOffsets,
} from "./toc-preview-freshness";
import type { TocPreviewSchedule } from "./toc-preview-freshness";
import { BoundedCache, tocPreviewLayout } from "./toc-preview-layout";
import type { TocPreviewLayout } from "./toc-preview-layout";
import {
  adoptCopiedStyles,
  syncShadowStyles,
  syncShadowTheme,
} from "./toc-shadow-styles";

export {
  TOC_PREVIEW_GAP,
  TOC_PREVIEW_INNER_HEIGHT,
  TOC_PREVIEW_INNER_WIDTH,
  TOC_PREVIEW_WIDTH,
} from "./toc-preview-layout";

export interface TocPreviewSection {
  id: string;
  peek: LandingSectionPeek;
}

/** One entry per section plus headroom for a stale width after a resize. */
const PREVIEW_CACHE_LIMIT = 8;
/** Fades a refreshed stage in over the stale one it replaces. */
const FRESH_CLASS = "animate-[lp-toc-preview-fresh_100ms_ease-out_both]";
/** `lp-toc-preview-fresh` duration plus a frame of slack. */
const CROSSFADE_MS = 100 + 20;
const REFRESH_INTERVAL = 1000;
const SCROLL_IDLE_MS = 180;
const IDLE_TIMEOUT = 1500;
/** A refresh of the peek on screen should not wait long for idle time. */
const SHOWN_IDLE_TIMEOUT = 150;

/**
 * Stages live in a shadow root on the peek card's screen because `:has()` does
 * not look across a shadow boundary: inserting a stage of hundreds of nodes
 * then restyles only the stage, whatever `:has()` rules the app CSS holds.
 */
let previewHost: HTMLElement | null = null;
/** Where stages are appended: the scope inside the shadow root (or the host). */
let stageContainer: HTMLElement | null = null;

const pendingScroll = new WeakMap<HTMLElement, PendingScroll>();

const previewCache = new BoundedCache<string, HTMLElement>(
  PREVIEW_CACHE_LIMIT,
  retireStage,
);

let activeSection: TocPreviewSection | null = null;
let railVisible = false;
let freshness: TocPreviewFreshness | null = null;
/** Wakes the refresh loop; set while `warmTocSectionPreviews` runs. */
let requestRefresh: (() => void) | null = null;

function cacheKey(sectionId: string, layout: TocPreviewLayout): string {
  return `${sectionId}@${String(layout.layoutWidth)}`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function shadowScope(): { root: ShadowRoot; scope: HTMLElement } | null {
  const root = stageContainer?.getRootNode();
  return root instanceof ShadowRoot && stageContainer !== null
    ? { root, scope: stageContainer }
    : null;
}

/**
 * Lays the stage out while it is still renderable, then parks it.
 * `content-visibility: hidden` keeps that rendering state, so the first reveal
 * skips style and layout.
 */
function parkInHost(stage: HTMLElement): void {
  if (stageContainer === null || stage.parentElement === stageContainer) {
    return;
  }
  stage.classList.remove(ACTIVE_CLASS, FRESH_CLASS);
  stage.style.contentVisibility = "visible";
  stageContainer.append(stage);
  stage.getBoundingClientRect();
  const scroll = pendingScroll.get(stage);
  if (scroll !== undefined) {
    applyScrollOffsets(scroll.elements, scroll.offsets);
  }
  stage.style.removeProperty("content-visibility");
}

/** Leave the cache: drop the DOM, after the crossfade if it is on screen. */
function retireStage(stage: HTMLElement): void {
  if (
    stage.classList.contains(ACTIVE_CLASS) &&
    stage.parentElement !== null &&
    !prefersReducedMotion()
  ) {
    window.setTimeout(() => {
      stage.remove();
    }, CROSSFADE_MS);
    return;
  }
  stage.remove();
}

function sectionElement(id: string): HTMLElement | null {
  const element = document.querySelector(`#${CSS.escape(id)}`);
  return element instanceof HTMLElement ? element : null;
}

function cachedPreview(sectionId: string): HTMLElement | undefined {
  const layout = tocPreviewLayout(window.innerWidth);
  return previewCache.get(cacheKey(sectionId, layout));
}

function activateStage(stage: HTMLElement | null): void {
  if (stageContainer === null) {
    return;
  }
  for (const child of stageContainer.children) {
    child.classList.toggle(ACTIVE_CLASS, child === stage);
    if (child !== stage) {
      child.classList.remove(FRESH_CLASS);
    }
  }
}

/** A replaced peek that is on screen leaves once the new one has faded in over it. */
function buildAndPark(section: TocPreviewSection): HTMLElement | null {
  const element = sectionElement(section.id);
  if (element === null) {
    return null;
  }

  const shadow = shadowScope();
  if (shadow !== null) {
    syncShadowStyles(shadow.root);
    syncShadowTheme(shadow.scope);
  }
  const layout = tocPreviewLayout(window.innerWidth);
  const key = cacheKey(section.id, layout);
  const previous = previewCache.has(key) ? previewCache.get(key) : undefined;
  const { stage, scroll } = buildPreview(element, section.peek, layout);
  if (scroll !== null) {
    pendingScroll.set(stage, scroll);
  }
  parkInHost(stage);

  if (activeSection !== null && activeSection.id === section.id) {
    const crossfade =
      previous?.classList.contains(ACTIVE_CLASS) === true &&
      !prefersReducedMotion();
    if (crossfade) {
      stage.classList.add(ACTIVE_CLASS, FRESH_CLASS);
    } else {
      // A rebuild (resize, theme change) drops every stage, including the
      // one on screen; when the warm-up recreates it, put it straight back.
      activateStage(stage);
    }
  }
  // Evicts `previous` through `retireStage`.
  previewCache.set(key, stage);
  freshness?.markBuilt(section.id, performance.now());
  return stage;
}

function ensurePreview(section: TocPreviewSection): HTMLElement | null {
  const cached = cachedPreview(section.id);
  if (cached !== undefined) {
    parkInHost(cached);
    return cached;
  }
  return buildAndPark(section);
}

export function attachTocPreviewHost(host: HTMLElement): () => void {
  previewHost = host;
  if (
    typeof host.attachShadow === "function" &&
    "adoptedStyleSheets" in document
  ) {
    const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    let scope = root.firstElementChild;
    if (!(scope instanceof HTMLElement)) {
      scope = document.createElement("div");
      root.append(scope);
    }
    stageContainer = scope as HTMLElement;
    // A new shadow root has no styles yet; never show unstyled stages.
    if (!adoptCopiedStyles(root) && previewCache.size > 0) {
      syncShadowStyles(root);
    }
    syncShadowTheme(stageContainer);
  } else {
    stageContainer = host;
  }
  for (const stage of previewCache.values()) {
    parkInHost(stage);
  }
  return () => {
    const container = stageContainer;
    if (previewHost === host) {
      previewHost = null;
      stageContainer = null;
    }
    for (const stage of previewCache.values()) {
      if (container !== null && stage.parentElement === container) {
        stage.remove();
      }
    }
  };
}

export function showTocSectionPreview(section: TocPreviewSection | null): void {
  activeSection = section;
  activateStage(section === null ? null : ensurePreview(section));
  // Stale while revalidate: the parked clone shows now, a current one fades
  // in over it in the next idle slot.
  if (section !== null && freshness?.isStale(section.id) === true) {
    requestRefresh?.();
  }
}

/** Whether the rail is on screen; refreshes dirty peeks only while it is. */
export function setTocPreviewRailVisible(visible: boolean): void {
  railVisible = visible;
  if (visible) {
    requestRefresh?.();
  }
}

export function invalidateTocSectionPreviews(): void {
  previewCache.clear();
  freshness?.reset();
}

type IdleScheduler = (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
) => number;

/**
 * Builds one peek per idle period after load, then re-clones sections a
 * `MutationObserver` marks dirty (see `TocPreviewFreshness`).
 */
export function warmTocSectionPreviews(
  sections: readonly TocPreviewSection[],
): () => void {
  const requestIdle = Reflect.get(window, "requestIdleCallback") as
    | IdleScheduler
    | undefined;
  const cancelIdle = Reflect.get(window, "cancelIdleCallback") as
    | ((handle: number) => void)
    | undefined;

  const tracker = new TocPreviewFreshness(
    sections.map((section) => section.id),
    REFRESH_INTERVAL,
  );
  // Peeks that survived a stop (bfcache) or an earlier warm stay valid.
  const layout = tocPreviewLayout(window.innerWidth);
  for (const section of sections) {
    if (previewCache.has(cacheKey(section.id, layout))) {
      tracker.markBuilt(section.id, Number.NEGATIVE_INFINITY);
      tracker.markDirty(section.id);
    }
  }
  freshness = tracker;

  let idleHandle = 0;
  let timer = 0;
  let timerDue = 0;
  let lastScrollAt = Number.NEGATIVE_INFINITY;
  let stopped = false;

  const schedule = (): TocPreviewSchedule => ({
    now: performance.now(),
    visible: railVisible,
    scrolling: performance.now() - lastScrollAt < SCROLL_IDLE_MS,
    shown: activeSection?.id ?? null,
  });

  const clearTimer = (): void => {
    if (timer !== 0) {
      window.clearTimeout(timer);
      timer = 0;
    }
  };

  function step(): void {
    idleHandle = 0;
    if (stopped) {
      return;
    }
    const id = tracker.next(schedule());
    const section =
      id === null ? undefined : sections.find((entry) => entry.id === id);
    // Not in the document (yet): mark it built so the loop does not spin.
    if (section !== undefined && buildAndPark(section) === null) {
      tracker.markBuilt(section.id, performance.now());
    }
    wake();
  }

  /** Queue the next idle step if anything is wanted, or a timer until it is. */
  function wake(): void {
    if (stopped || idleHandle !== 0) {
      return;
    }
    const current = schedule();
    const wait = tracker.delay(current);
    if (wait === null) {
      return;
    }
    const sinceScroll = current.now - lastScrollAt;
    const settle =
      sinceScroll < SCROLL_IDLE_MS ? SCROLL_IDLE_MS - sinceScroll : 0;
    const delay = Math.max(wait, settle);
    if (delay > 0) {
      const due = current.now + delay;
      if (timer === 0 || due < timerDue) {
        clearTimer();
        timerDue = due;
        timer = window.setTimeout(() => {
          timer = 0;
          wake();
        }, delay + 1);
      }
      return;
    }
    clearTimer();
    const timeout =
      current.shown !== null && tracker.isStale(current.shown)
        ? SHOWN_IDLE_TIMEOUT
        : IDLE_TIMEOUT;
    idleHandle =
      requestIdle === undefined
        ? window.setTimeout(step, 50)
        : requestIdle(step, { timeout });
  }

  const handleWindowScroll = (): void => {
    lastScrollAt = performance.now();
  };

  const observers: MutationObserver[] = [];
  const listeners: [HTMLElement, string, () => void][] = [];
  for (const section of sections) {
    const element = sectionElement(section.id);
    if (element === null) {
      continue;
    }
    const markDirty = (): void => {
      tracker.markDirty(section.id);
      wake();
    };
    // Inner scrollers do not gate rebuilds: a section that scrolls itself
    // would otherwise keep its preview permanently dirty.
    const markScrolled = (): void => {
      tracker.markScrolled(section.id);
      wake();
    };
    // Text edits (`characterData`) are left out: the demo quiz's clock ticks
    // every second and would keep the showcase permanently dirty.
    const observer = new MutationObserver(markDirty);
    // Only the live/static switch changes the hero still. Never observe its
    // per-frame progress writes or the three live screen subtrees.
    if (section.peek === "hero") {
      observer.observe(element, {
        attributes: true,
        attributeFilter: ["data-hero-static"],
      });
      observers.push(observer);
      continue;
    }
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: TOC_PREVIEW_OBSERVED_ATTRIBUTES,
    });
    observers.push(observer);
    // `scroll` does not bubble, but a capture listener sees inner scrollers;
    // `input` covers typed values, which live in properties.
    element.addEventListener("scroll", markScrolled, {
      capture: true,
      passive: true,
    });
    element.addEventListener("input", markDirty, { capture: true });
    listeners.push(
      [element, "scroll", markScrolled],
      [element, "input", markDirty],
    );
  }

  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  requestRefresh = wake;
  wake();

  return () => {
    stopped = true;
    if (requestRefresh === wake) {
      requestRefresh = null;
    }
    if (freshness === tracker) {
      freshness = null;
    }
    for (const observer of observers) {
      observer.disconnect();
    }
    for (const [element, type, listener] of listeners) {
      element.removeEventListener(type, listener, { capture: true });
    }
    window.removeEventListener("scroll", handleWindowScroll);
    clearTimer();
    if (idleHandle === 0) {
      return;
    }
    if (requestIdle === undefined || cancelIdle === undefined) {
      window.clearTimeout(idleHandle);
    } else {
      cancelIdle(idleHandle);
    }
  };
}
