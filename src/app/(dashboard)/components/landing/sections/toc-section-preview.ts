/** Inner screen width — same for every section peek. */
export const TOC_PREVIEW_INNER_WIDTH = 268;
/** Inner screen height — same for every section peek. */
export const TOC_PREVIEW_INNER_HEIGHT = 140;
/** Outer card width (inner screen + horizontal padding). */
export const TOC_PREVIEW_WIDTH = TOC_PREVIEW_INNER_WIDTH + 16;
/** Gap between the expanded TOC rail and the peek card. */
export const TOC_PREVIEW_GAP = 14;

const previewCache = new Map<string, HTMLElement>();

function resolvePreviewSource(section: HTMLElement): HTMLElement {
  if (section.id === "start") {
    const sticky = section.querySelector<HTMLElement>(":scope > .sticky");
    if (sticky !== null) {
      return sticky;
    }
  }
  return section;
}

function neutralizeClone(clone: HTMLElement, layoutWidth: number): void {
  clone.removeAttribute("id");
  clone.style.margin = "0";
  clone.style.transform = "none";
  clone.style.position = "relative";
  clone.style.inset = "auto";
  clone.style.top = "0";
  clone.style.left = "0";
  clone.style.width = `${String(layoutWidth)}px`;
  clone.style.maxWidth = `${String(layoutWidth)}px`;
  clone.style.minWidth = `${String(layoutWidth)}px`;
  clone.style.boxSizing = "border-box";
  clone.style.pointerEvents = "none";
  clone.style.animation = "none";
  clone.style.transition = "none";

  for (const node of clone.querySelectorAll<HTMLElement>("*")) {
    node.removeAttribute("id");
    node.style.animation = "none";
    node.style.transition = "none";
    node.style.scrollMargin = "0";
    if (node instanceof HTMLAnchorElement) {
      node.removeAttribute("href");
      node.setAttribute("tabindex", "-1");
    }
    if (
      node instanceof HTMLButtonElement ||
      node instanceof HTMLInputElement ||
      node instanceof HTMLSelectElement ||
      node instanceof HTMLTextAreaElement
    ) {
      node.disabled = true;
      node.setAttribute("tabindex", "-1");
    }
  }
}

function snapshotCanvases(source: HTMLElement, clone: HTMLElement): void {
  const sourceCanvases = [
    ...source.querySelectorAll<HTMLCanvasElement>("canvas"),
  ];
  const cloneCanvases = [
    ...clone.querySelectorAll<HTMLCanvasElement>("canvas"),
  ];

  for (const [index, sourceCanvas] of sourceCanvases.entries()) {
    const target = cloneCanvases[index];
    if (target === undefined) {
      continue;
    }

    const width = Math.max(
      1,
      sourceCanvas.width || sourceCanvas.clientWidth || 1,
    );
    const height = Math.max(
      1,
      sourceCanvas.height || sourceCanvas.clientHeight || 1,
    );
    target.width = width;
    target.height = height;

    const context = target.getContext("2d");
    if (context === null) {
      continue;
    }

    try {
      context.drawImage(sourceCanvas, 0, 0, width, height);
    } catch {
      const placeholder = document.createElement("div");
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.style.width = "100%";
      placeholder.style.height = "100%";
      placeholder.style.minHeight = `${String(Math.min(height, 240))}px`;
      placeholder.style.background =
        "color-mix(in oklab, var(--muted) 70%, transparent)";
      target.replaceWith(placeholder);
    }
  }
}

function replaceHeavyMedia(clone: HTMLElement): void {
  for (const media of clone.querySelectorAll("video, iframe")) {
    const placeholder = document.createElement("div");
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.style.width = "100%";
    placeholder.style.height = "100%";
    placeholder.style.minHeight = "8rem";
    placeholder.style.background =
      "color-mix(in oklab, var(--muted) 55%, transparent)";
    media.replaceWith(placeholder);
  }
}

/**
 * Build (or reuse) a scaled, inert snapshot of a landing section for the TOC peek.
 * Every peek uses the same layout box + scale so type size stays consistent.
 */
export function getTocSectionPreview(sectionId: string): HTMLElement | null {
  const cached = previewCache.get(sectionId);
  if (cached !== undefined) {
    return cached;
  }

  const section = document.querySelector(`#${CSS.escape(sectionId)}`);
  if (!(section instanceof HTMLElement)) {
    return null;
  }

  const source = resolvePreviewSource(section);
  const layoutWidth = Math.max(window.innerWidth, 1024);
  const layoutHeight = Math.max(window.innerHeight, 640);
  const scale = TOC_PREVIEW_INNER_WIDTH / layoutWidth;

  const stage = document.createElement("div");
  stage.dataset.tocPreviewStage = sectionId;
  stage.className = "lp-toc-preview-stage";
  stage.style.width = `${String(layoutWidth)}px`;
  stage.style.height = `${String(layoutHeight)}px`;
  stage.style.overflow = "hidden";
  stage.style.transform = `scale(${String(scale)})`;
  stage.style.transformOrigin = "top left";
  stage.style.pointerEvents = "none";
  stage.style.userSelect = "none";
  stage.setAttribute("aria-hidden", "true");

  const clone = source.cloneNode(true) as HTMLElement;
  neutralizeClone(clone, layoutWidth);
  snapshotCanvases(source, clone);
  replaceHeavyMedia(clone);
  clone.style.height = `${String(layoutHeight)}px`;
  clone.style.minHeight = `${String(layoutHeight)}px`;
  clone.style.overflow = "hidden";

  stage.append(clone);
  previewCache.set(sectionId, stage);
  return stage;
}

/** Drop cached peeks so the next hover rebuilds against current layout. */
export function invalidateTocSectionPreviews(): void {
  previewCache.clear();
}

/** Warm peeks one section at a time during idle so the main thread stays free. */
export function warmTocSectionPreviews(sectionIds: readonly string[]): void {
  let index = 0;

  const step = (): void => {
    while (index < sectionIds.length) {
      const sectionId = sectionIds[index];
      index += 1;
      if (sectionId === undefined || previewCache.has(sectionId)) {
        continue;
      }
      getTocSectionPreview(sectionId);
      break;
    }

    if (index >= sectionIds.length) {
      return;
    }

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(step, { timeout: 1200 });
      return;
    }
    window.setTimeout(step, 180);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(step, { timeout: 1600 });
    return;
  }
  window.setTimeout(step, 500);
}
