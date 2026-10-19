import { DESKTOP_STAGE_QUERY } from "../breakpoints";
import { HERO_PROGRESS_PROPERTY } from "../hero-progress";
import type { LandingSectionPeek } from "../landing-sections";
import { wordmarkDark } from "../logos";
import { DEVICE_COVER_CLASS } from "../scene/scene-classes";
import {
  TOC_PREVIEW_OBSERVED_ATTRIBUTES,
  TocPreviewFreshness,
  applyScrollOffsets,
  captureScrollOffsets,
  copyControlState,
} from "./toc-preview-freshness";
import type { ScrollOffset, TocPreviewSchedule } from "./toc-preview-freshness";
import {
  BoundedCache,
  tocPreviewLayout,
  tocPreviewOffset,
} from "./toc-preview-layout";
import type { TocPreviewLayout } from "./toc-preview-layout";

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
/** `lg:min-h-[42rem]` on the hero's sticky stage. */
const HERO_MIN_HEIGHT = 42 * 16;
/** `top-[5.3rem]`: the device layer starts below the hero navigation. */
const HERO_DEVICE_TOP = "5.3rem";
/**
 * Marks the revealed stage. A class rather than a `data-*` attribute: the app
 * CSS has `:has([data-…])` rules, and an attribute flip they might match makes
 * Chrome restyle the whole document.
 */
const ACTIVE_CLASS = "lp-toc-preview-active";
/** Fades a refreshed stage in over the stale one it replaces. */
const FRESH_CLASS = "lp-toc-preview-fresh";
/** `lp-toc-preview-fresh` duration plus a frame of slack. */
const CROSSFADE_MS = 100 + 20;
/** At most one rebuild per section per this many milliseconds. */
const REFRESH_INTERVAL = 1000;
/** Scrolling counts as settled after this long without a scroll event. */
const SCROLL_IDLE_MS = 180;
/** Upper bound on waiting for an idle period. */
const IDLE_TIMEOUT = 1500;
/** A refresh of the peek on screen should not wait long for idle time. */
const SHOWN_IDLE_TIMEOUT = 150;

/**
 * The peek card's screen. Stages live in a shadow root on it, permanently,
 * with `content-visibility: hidden` while parked, so showing one is a class
 * flip.
 *
 * Why a shadow root: the app CSS has Tailwind `group-has-*` rules
 * (`:is(:where(.group\/x):has(…) *)`), and while any of them exists Chrome
 * restyles the whole document on every element inserted or removed anywhere
 * in it (~30 ms of style recalc at 4x CPU, for an empty `div`). `:has()` does
 * not look across a shadow boundary, so inserting or removing a stage in here
 * only restyles the stage.
 */
let previewHost: HTMLElement | null = null;
/** Where stages are appended: the scope inside the shadow root (or the host). */
let stageContainer: HTMLElement | null = null;
/** Constructed copies of the page stylesheets, adopted by the shadow root. */
let shadowStyles: CSSStyleSheet[] | null = null;
let shadowStylesSignature = "";

/** Scroll positions to replay on a stage's clone once it is laid out. */
interface PendingScroll {
  elements: readonly Element[];
  offsets: readonly ScrollOffset[];
}
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

function px(value: number): string {
  return `${String(value)}px`;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A cheap fingerprint of the page CSS. Changes when a stylesheet is added,
 * removed or toggled (a lazily loaded chunk, a dev-server hot update).
 */
function styleSignature(): string {
  const parts: string[] = [];
  for (const sheet of document.styleSheets) {
    let rules = -1;
    try {
      rules = sheet.cssRules.length;
    } catch {
      // Cross-origin sheet: its rules are unreadable, so they are not copied.
    }
    parts.push(
      `${sheet.href ?? "inline"}:${String(rules)}:${String(sheet.disabled)}`,
    );
  }
  return parts.join("|");
}

/**
 * One constructed sheet per page sheet (and per `@import`ed one), keeping its
 * base URL so relative `url()`s still resolve and its media list.
 */
function copyStyleSheet(sheet: CSSStyleSheet, into: CSSStyleSheet[]): void {
  if (sheet.disabled) {
    return;
  }
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    // Cross-origin: skip.
    return;
  }
  const chunks: string[] = [];
  const flush = (): void => {
    if (chunks.length === 0) {
      return;
    }
    const copy = new CSSStyleSheet({
      baseURL: sheet.href ?? document.baseURI,
      media: sheet.media.mediaText,
    });
    copy.replaceSync(chunks.join("\n"));
    into.push(copy);
    chunks.length = 0;
  };
  for (const rule of rules) {
    // Constructed sheets reject `@import`; inline the imported sheet instead.
    if (rule instanceof CSSImportRule) {
      flush();
      if (rule.styleSheet !== null) {
        copyStyleSheet(rule.styleSheet, into);
      }
      continue;
    }
    chunks.push(rule.cssText);
  }
  flush();
}

/**
 * Copy the page CSS into the shadow root so clones render as they do in the
 * page. Serialising takes a few tens of milliseconds at 4x CPU, so it runs in
 * the first idle build and only again when the page CSS changes.
 */
function syncShadowStyles(): void {
  const root = stageContainer?.getRootNode();
  if (!(root instanceof ShadowRoot)) {
    return;
  }
  const signature = styleSignature();
  if (shadowStyles === null || signature !== shadowStylesSignature) {
    const sheets: CSSStyleSheet[] = [];
    for (const sheet of document.styleSheets) {
      copyStyleSheet(sheet, sheets);
    }
    shadowStyles = sheets;
    shadowStylesSignature = signature;
  }
  const adopted = root.adoptedStyleSheets;
  if (
    adopted.length !== shadowStyles.length ||
    adopted.some((sheet, index) => sheet !== shadowStyles?.[index])
  ) {
    root.adoptedStyleSheets = shadowStyles;
  }
}

/**
 * `dark:` compiles to `:is(.dark *)`, which cannot see `html.dark` from inside
 * a shadow root; mirror the theme class onto the scope instead. A theme switch
 * rebuilds every peek, which calls this again.
 */
function syncShadowTheme(): void {
  if (stageContainer === null || stageContainer === previewHost) {
    return;
  }
  stageContainer.classList.toggle(
    "dark",
    document.documentElement.classList.contains("dark"),
  );
}

function createStage(sectionId: string, layout: TocPreviewLayout): HTMLElement {
  const stage = document.createElement("div");
  stage.dataset.tocPreviewStage = sectionId;
  stage.className = "lp-toc-preview-stage";
  stage.inert = true;
  stage.setAttribute("aria-hidden", "true");
  stage.style.width = px(layout.layoutWidth);
  stage.style.height = px(layout.windowHeight);
  stage.style.transform = `scale(${String(layout.scale)})`;
  return stage;
}

/**
 * Strip ids (no duplicates in the document) and link targets. Focus is covered
 * by `inert` on the stage and motion by the `.lp-toc-preview-stage` CSS rule,
 * so no per-node style writes are needed.
 */
function neutralizeTree(root: HTMLElement): void {
  root.removeAttribute("id");
  for (const node of root.querySelectorAll("[id], a[href]")) {
    node.removeAttribute("id");
    node.removeAttribute("href");
  }
}

/**
 * Canvases are WebGL (no `preserveDrawingBuffer`, so they read back blank) or
 * html-in-canvas surfaces that redraw the copy at the wrong scale; video and
 * iframes are too heavy to duplicate. None of them belongs in a peek.
 */
function dropUncloneableMedia(clone: HTMLElement): void {
  for (const media of clone.querySelectorAll("canvas, video, iframe")) {
    media.remove();
  }
}

/** The finale's wordmark is a particle canvas; stand the still logo in. */
function fillWordmarks(clone: HTMLElement): void {
  for (const slot of clone.querySelectorAll<HTMLElement>(
    "[data-toc-peek-wordmark]",
  )) {
    const image = document.createElement("img");
    image.src = wordmarkDark.src;
    image.alt = "";
    image.decoding = "async";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "contain";
    slot.replaceChildren(image);
  }
}

/**
 * Deep-clone a live section with the state `cloneNode` leaves behind: form
 * control properties now, inner scroll positions once the clone is laid out.
 */
function cloneLiveSection(section: HTMLElement): {
  clone: HTMLElement;
  scroll: PendingScroll;
} {
  const clone = section.cloneNode(true) as HTMLElement;
  // Static lists, in document order, taken before anything is removed.
  const liveElements = section.querySelectorAll("*");
  const cloneElements = [...clone.querySelectorAll("*")];
  copyControlState(liveElements, cloneElements);
  return {
    clone,
    scroll: {
      elements: cloneElements,
      offsets: captureScrollOffsets(liveElements),
    },
  };
}

function buildClonePeek(
  section: HTMLElement,
  layout: TocPreviewLayout,
  align: "top" | "center",
): HTMLElement {
  const stage = createStage(section.id, layout);
  const offset = tocPreviewOffset(
    section.offsetHeight,
    layout.windowHeight,
    align,
  );

  const { clone, scroll } = cloneLiveSection(section);
  neutralizeTree(clone);
  dropUncloneableMedia(clone);
  fillWordmarks(clone);
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.margin = "0";
  clone.style.width = px(layout.layoutWidth);
  clone.style.maxWidth = px(layout.layoutWidth);
  clone.style.minWidth = px(layout.layoutWidth);
  clone.style.boxSizing = "border-box";
  clone.style.transform = offset === 0 ? "none" : `translateY(${px(-offset)})`;

  stage.append(clone);
  if (scroll.offsets.length > 0) {
    pendingScroll.set(stage, scroll);
  }
  return stage;
}

/**
 * The hero at progress zero, rebuilt from parts that clone cleanly: the
 * navigation, the copy and the device-stack still the scene itself uses as a
 * loading cover. Laid out at the real hero height, then fitted into the peek
 * window so the whole stack shows instead of its top two thirds.
 *
 * Progress zero (closed lid) on purpose: following the link scrolls to the
 * top of the page, where the lid is closed, so that is the state the visitor
 * lands on whatever the scene shows mid-scroll.
 */
function buildHeroPeek(
  section: HTMLElement,
  layout: TocPreviewLayout,
): HTMLElement | null {
  const header = section.querySelector("header");
  const copy = section.querySelector("h1")?.parentElement;
  if (header === null || copy === null || copy === undefined) {
    return null;
  }

  const stage = createStage(section.id, layout);
  const heroHeight = Math.max(window.innerHeight, HERO_MIN_HEIGHT);
  const fit = Math.min(1, layout.windowHeight / heroHeight);

  const hero = document.createElement("div");
  hero.style.position = "absolute";
  hero.style.top = "0";
  hero.style.left = "0";
  hero.style.width = px(layout.layoutWidth);
  hero.style.height = px(heroHeight);
  hero.style.transform = `scale(${String(fit)})`;
  hero.style.transformOrigin = "top center";
  hero.style.setProperty(HERO_PROGRESS_PROPERTY, "0");

  const headerClone = header.cloneNode(true) as HTMLElement;
  neutralizeTree(headerClone);

  const copyClone = copy.cloneNode(true) as HTMLElement;
  neutralizeTree(copyClone);
  copyClone.style.opacity = "1";
  copyClone.style.transform = "none";

  const deviceLayer = document.createElement("div");
  deviceLayer.style.position = "absolute";
  deviceLayer.style.inset = `${HERO_DEVICE_TOP} 0 0 0`;
  deviceLayer.style.containerType = "size";
  const cover = document.createElement("div");
  cover.className = DEVICE_COVER_CLASS;
  deviceLayer.append(cover);

  hero.append(headerClone, copyClone, deviceLayer);
  stage.append(hero);
  return stage;
}

function isDesktopHero(): boolean {
  // Below `lg` the hero is the CSS phone, which clones fine.
  return window.matchMedia(DESKTOP_STAGE_QUERY).matches;
}

function buildPreview(
  section: HTMLElement,
  peek: LandingSectionPeek,
  layout: TocPreviewLayout,
): HTMLElement {
  if (peek === "hero" && isDesktopHero()) {
    const hero = buildHeroPeek(section, layout);
    if (hero !== null) {
      return hero;
    }
  }
  return buildClonePeek(section, layout, peek === "center" ? "center" : "top");
}

/**
 * Put a stage into the host and lay it out while it is still renderable, then
 * park it. `content-visibility: hidden` keeps that rendering state (scroll
 * offsets included), so the first reveal does not pay for style and layout of
 * a 1440px-wide clone.
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

/**
 * Build a peek from the section as it is now and park it, replacing any
 * older one. When the replaced peek is on screen, the new one fades in on top
 * of it in the same box and the old one leaves once covered.
 */
function buildAndPark(section: TocPreviewSection): HTMLElement | null {
  const element = sectionElement(section.id);
  if (element === null) {
    return null;
  }

  syncShadowStyles();
  syncShadowTheme();
  const layout = tocPreviewLayout(window.innerWidth);
  const key = cacheKey(section.id, layout);
  const previous = previewCache.has(key) ? previewCache.get(key) : undefined;
  const stage = buildPreview(element, section.peek, layout);
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

/**
 * The parked peek for a section, building it only if the idle warm-up has
 * not got there yet (a hover that beats it).
 */
function ensurePreview(section: TocPreviewSection): HTMLElement | null {
  const cached = cachedPreview(section.id);
  if (cached !== undefined) {
    parkInHost(cached);
    return cached;
  }
  return buildAndPark(section);
}

/**
 * Register the peek card's screen as the stage host. Already-built stages move
 * in immediately. Returns a detach function.
 */
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
    if (shadowStyles !== null) {
      root.adoptedStyleSheets = shadowStyles;
    } else if (previewCache.size > 0) {
      syncShadowStyles();
    }
    syncShadowTheme();
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

/** Reveal one section's peek in the host and park every other one. */
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

/** Drop cached peeks (and their DOM) so the next build uses current layout. */
export function invalidateTocSectionPreviews(): void {
  previewCache.clear();
  freshness?.reset();
}

type IdleScheduler = (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
) => number;

/**
 * Build peeks one section per idle period after load, then keep them current:
 * a `MutationObserver` per section marks it dirty, and dirty peeks are
 * re-cloned in idle time while the rail is visible (the one on screen
 * always), never while scrolling and at most once a second per section.
 * Returns a stop function.
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
    // The hero peek is a still at progress zero; its live DOM is irrelevant.
    if (section.peek === "hero") {
      continue;
    }
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
