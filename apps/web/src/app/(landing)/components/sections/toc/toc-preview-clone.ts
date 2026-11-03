/** A peek's stage: a scaled, inert copy of a live section. */
import { DESKTOP_STAGE_QUERY } from "../../breakpoints";
import { HERO_PROGRESS_PROPERTY } from "../../hero-progress";
import type { LandingSectionPeek } from "../../landing-sections";
import { wordmarkDark } from "../../logos";
import {
  captureScrollOffsets,
  copyControlState,
} from "./toc-preview-freshness";
import type { ScrollOffset } from "./toc-preview-freshness";
import { tocPreviewOffset } from "./toc-preview-layout";
import type { TocPreviewLayout } from "./toc-preview-layout";

/** `lg:min-h-[42rem]` on the hero's sticky stage. */
const HERO_MIN_HEIGHT = 42 * 16;
/** `top-[5.3rem]`: the device layer starts below the hero navigation. */
const HERO_DEVICE_TOP = "5.3rem";
/** The open-pose still the static hero shows; see `hero-desktop-stage.tsx`. */
const HERO_PEEK_COVER_CLASS =
  "pointer-events-none absolute inset-x-0 top-[38%] bottom-[3%] bg-[url(/models/testownik-device-stack-open-light-v1.webp)] bg-contain bg-center bg-no-repeat dark:bg-[url(/models/testownik-device-stack-open-dark-v1.webp)]";
/**
 * Marks the revealed stage. A class rather than a `data-*` attribute: the app
 * CSS has `:has([data-…])` rules, and an attribute flip they might match sends
 * Chrome through `:has()` invalidation; a class no rule mentions does not.
 */
export const ACTIVE_CLASS = "lp-toc-preview-active";
/**
 * Parked stages keep their layout but skip rendering, so revealing one is a
 * class flip. `visibility` hides the stage's own background, which
 * `content-visibility` still paints.
 */
const STAGE_CLASS = [
  "lp-toc-preview-stage bg-background text-foreground pointer-events-none absolute top-0 left-0 origin-top-left overflow-hidden select-none contain-layout contain-paint contain-style motion-reduce:animate-none",
  "not-[.lp-toc-preview-active]:invisible not-[.lp-toc-preview-active]:[content-visibility:hidden]",
].join(" ");

export interface PendingScroll {
  elements: readonly Element[];
  offsets: readonly ScrollOffset[];
}

export interface BuiltPreview {
  stage: HTMLElement;
  scroll: PendingScroll | null;
}

function px(value: number): string {
  return `${String(value)}px`;
}

function createStage(sectionId: string, layout: TocPreviewLayout): HTMLElement {
  const stage = document.createElement("div");
  stage.dataset.tocPreviewStage = sectionId;
  stage.className = STAGE_CLASS;
  stage.inert = true;
  stage.setAttribute("aria-hidden", "true");
  stage.style.width = px(layout.layoutWidth);
  stage.style.height = px(layout.windowHeight);
  stage.style.transform = `scale(${String(layout.scale)})`;
  return stage;
}

/**
 * Strips ids so none are duplicated, and turns links into text: an anchor
 * without href still looks like a broken link to crawlers.
 */
function neutralizeTree(root: HTMLElement): void {
  root.removeAttribute("id");
  for (const node of root.querySelectorAll("[id]")) {
    node.removeAttribute("id");
  }
  for (const link of root.querySelectorAll("a")) {
    const text = document.createElement("span");
    for (const { name, value } of link.attributes) {
      if (!["href", "target", "rel"].includes(name)) {
        text.setAttribute(name, value);
      }
    }
    text.append(...link.childNodes);
    link.replaceWith(text);
  }
}

/**
 * WebGL canvases read back blank (no `preserveDrawingBuffer`), html-in-canvas
 * ones redraw at the wrong scale, and video and iframes are too heavy.
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

// Reveal effects that have not run yet on the live page are shown finished.

export function finishPerkCounters(clone: HTMLElement): void {
  for (const counter of clone.querySelectorAll<HTMLElement>(
    "[data-perk-count]",
  )) {
    counter.textContent = counter.dataset.perkCount ?? "";
  }
}

export function finishTimelineReveal(clone: HTMLElement): void {
  for (const event of clone.querySelectorAll<HTMLElement>(
    "[data-timeline-revealed]",
  )) {
    event.dataset.timelineRevealed = "true";
  }
  for (const title of clone.querySelectorAll<HTMLElement>(
    "[data-timeline-title]",
  )) {
    title.textContent = title.dataset.timelineTitle ?? "";
  }
  for (const ink of clone.querySelectorAll<SVGElement>("[data-timeline-ink]")) {
    ink.style.strokeDashoffset = "0";
  }
}

/** Also carries the form state and scroll positions `cloneNode` leaves behind. */
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
): BuiltPreview {
  const stage = createStage(section.id, layout);
  // The preview window can be taller than the cloned section.
  const background = getComputedStyle(section).backgroundColor;
  if (background !== "rgba(0, 0, 0, 0)" && background !== "transparent") {
    stage.style.backgroundColor = background;
  }
  const offset = tocPreviewOffset(
    section.offsetHeight,
    layout.windowHeight,
    align,
  );

  const { clone, scroll } = cloneLiveSection(section);
  neutralizeTree(clone);
  dropUncloneableMedia(clone);
  fillWordmarks(clone);
  finishPerkCounters(clone);
  finishTimelineReveal(clone);
  clone.style.position = "relative";
  clone.style.inset = "auto";
  // The stage is already the layout width, so the section's own width and
  // margins resolve as on the page: `LandingSection` keeps its side gutters
  // (`mx-auto` on a narrower box), full-bleed sections fill the stage.
  clone.style.maxWidth = px(layout.layoutWidth);
  clone.style.boxSizing = "border-box";
  clone.style.transform = offset === 0 ? "none" : `translateY(${px(-offset)})`;

  stage.append(clone);
  return { stage, scroll: scroll.offsets.length > 0 ? scroll : null };
}

/**
 * The hero rebuilt from parts that clone cleanly: the navigation, the copy and
 * the device-stack still. Laid out at the real hero height, then fitted into
 * the peek window so the whole stack shows.
 */
function buildHeroPeek(
  section: HTMLElement,
  layout: TocPreviewLayout,
): BuiltPreview | null {
  const header = section.querySelector("header");
  const copy = section.querySelector("h1")?.parentElement;
  if (header === null || copy === null || copy === undefined) {
    return null;
  }

  const stage = createStage(section.id, layout);
  const isStatic = section.dataset.heroStatic === "true";
  const heroHeight = isStatic
    ? section.offsetHeight
    : Math.max(window.innerHeight, HERO_MIN_HEIGHT);
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
  // Always the open pose: the peek stands for the section as a whole, and the
  // visitor reaches the hero's resting state (devices open) by scrolling it.
  const cover = document.createElement("div");
  cover.className = HERO_PEEK_COVER_CLASS;
  deviceLayer.append(cover);

  hero.append(headerClone, copyClone, deviceLayer);
  stage.append(hero);
  return { stage, scroll: null };
}

function isDesktopHero(): boolean {
  // Below `lg` the hero is the CSS phone, which clones fine.
  return window.matchMedia(DESKTOP_STAGE_QUERY).matches;
}

export function buildPreview(
  section: HTMLElement,
  peek: LandingSectionPeek,
  layout: TocPreviewLayout,
): BuiltPreview {
  if (peek === "hero" && isDesktopHero()) {
    const hero = buildHeroPeek(section, layout);
    if (hero !== null) {
      return hero;
    }
  }
  return buildClonePeek(section, layout, peek === "center" ? "center" : "top");
}
