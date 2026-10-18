import { DESKTOP_STAGE_QUERY } from "../breakpoints";
import { HERO_PROGRESS_PROPERTY } from "../hero-progress";
import type { LandingSectionPeek } from "../landing-sections";
import { wordmarkDark } from "../logos";
import { DEVICE_COVER_CLASS } from "../scene/scene-classes";
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

/**
 * Where built peeks live: the screen of the always-mounted peek card. Stages
 * sit in it permanently with `content-visibility: hidden`, so showing one is a
 * class flip. Inserting DOM instead would trip the page's `body:has(...)`
 * rules and restyle every element (~50 ms on a 4x-throttled CPU).
 */
let previewHost: HTMLElement | null = null;

const previewCache = new BoundedCache<string, HTMLElement>(
  PREVIEW_CACHE_LIMIT,
  (stage) => {
    stage.remove();
  },
);

function cacheKey(sectionId: string, layout: TocPreviewLayout): string {
  return `${sectionId}@${String(layout.layoutWidth)}`;
}

function px(value: number): string {
  return `${String(value)}px`;
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

  const clone = section.cloneNode(true) as HTMLElement;
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
  return stage;
}

/**
 * The hero at progress zero, rebuilt from parts that clone cleanly: the
 * navigation, the copy and the device-stack still the scene itself uses as a
 * loading cover. Laid out at the real hero height, then fitted into the peek
 * window so the whole stack shows instead of its top two thirds.
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
 * park it. `content-visibility: hidden` keeps that rendering state, so the
 * first reveal does not pay for style and layout of a 1440px-wide clone.
 */
function parkInHost(stage: HTMLElement): void {
  if (previewHost === null || stage.parentElement === previewHost) {
    return;
  }
  stage.classList.remove(ACTIVE_CLASS);
  stage.style.contentVisibility = "visible";
  previewHost.append(stage);
  stage.getBoundingClientRect();
  stage.style.removeProperty("content-visibility");
}

function cachedPreview(sectionId: string): HTMLElement | undefined {
  const layout = tocPreviewLayout(window.innerWidth);
  return previewCache.get(cacheKey(sectionId, layout));
}

/**
 * Build (or reuse) a scaled, inert snapshot of a landing section for the TOC
 * peek. Normally already warm; building here is only the fallback for a hover
 * that beats the idle warm-up.
 */
function ensurePreview(section: TocPreviewSection): HTMLElement | null {
  const cached = cachedPreview(section.id);
  if (cached !== undefined) {
    parkInHost(cached);
    return cached;
  }

  const element = document.querySelector(`#${CSS.escape(section.id)}`);
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const layout = tocPreviewLayout(window.innerWidth);
  const stage = buildPreview(element, section.peek, layout);
  previewCache.set(cacheKey(section.id, layout), stage);
  parkInHost(stage);
  return stage;
}

/**
 * Register the peek card's screen as the stage host. Already-built stages move
 * in immediately. Returns a detach function.
 */
export function attachTocPreviewHost(host: HTMLElement): () => void {
  previewHost = host;
  for (const stage of previewCache.values()) {
    parkInHost(stage);
  }
  return () => {
    if (previewHost === host) {
      previewHost = null;
    }
    for (const stage of previewCache.values()) {
      if (stage.parentElement === host) {
        stage.remove();
      }
    }
  };
}

/** Reveal one section's peek in the host and park every other one. */
export function showTocSectionPreview(section: TocPreviewSection | null): void {
  const stage = section === null ? null : ensurePreview(section);
  if (previewHost === null) {
    return;
  }
  for (const child of previewHost.children) {
    child.classList.toggle(ACTIVE_CLASS, child === stage);
  }
}

/** Drop cached peeks (and their DOM) so the next build uses current layout. */
export function invalidateTocSectionPreviews(): void {
  previewCache.clear();
}

type IdleScheduler = (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
) => number;

/**
 * Build peeks one section per idle period so neither hover nor scroll pays for
 * a clone. Returns a cancel function.
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

  let index = 0;
  let handle = 0;
  let cancelled = false;

  const schedule = (): void => {
    if (cancelled || index >= sections.length) {
      return;
    }
    handle =
      requestIdle === undefined
        ? window.setTimeout(step, 120)
        : requestIdle(step, { timeout: 1500 });
  };

  function step(): void {
    handle = 0;
    if (cancelled) {
      return;
    }
    while (index < sections.length) {
      const section = sections[index];
      index += 1;
      const cached = cachedPreview(section.id);
      if (cached?.parentElement !== previewHost) {
        ensurePreview(section);
        break;
      }
    }
    schedule();
  }

  schedule();

  return () => {
    cancelled = true;
    if (handle === 0) {
      return;
    }
    if (requestIdle === undefined || cancelIdle === undefined) {
      window.clearTimeout(handle);
    } else {
      cancelIdle(handle);
    }
  };
}
