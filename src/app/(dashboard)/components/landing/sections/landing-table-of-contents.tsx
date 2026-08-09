"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import {
  getTocSectionPreview,
  invalidateTocSectionPreviews,
  TOC_PREVIEW_GAP,
  TOC_PREVIEW_INNER_HEIGHT,
  TOC_PREVIEW_INNER_WIDTH,
  TOC_PREVIEW_WIDTH,
  warmTocSectionPreviews,
} from "./toc-section-preview";

const SECTIONS = [
  { id: "start", label: "Na początek" },
  { id: "features", label: "Zobacz w praktyce" },
  { id: "story", label: "Nasza historia" },
  { id: "team", label: "Poznaj zespół" },
  { id: "footer", label: "Zacznij korzystać" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const SHOW_AFTER_SCROLL = 160;
const IDLE_HIDE_DELAY = 2800;
const POINTER_REVEAL_WIDTH = 88;
const POINTER_REVEAL_PADDING = 24;
const PREVIEW_SHOW_DELAY = 140;
const PREVIEW_HIDE_DELAY = 120;
const PREVIEW_BOOM_MS = 360;
/** Outer chrome: padding + screen + caption row. */
const PREVIEW_CARD_HEIGHT = TOC_PREVIEW_INNER_HEIGHT + 8 + 8 + 36;

type PreviewMotion = "hidden" | "in" | "out";

function clampPreviewTop(centerY: number): number {
  const half = PREVIEW_CARD_HEIGHT / 2;
  const min = half + 12;
  const max = window.innerHeight - half - 12;
  if (max <= min) {
    return window.innerHeight / 2;
  }
  return Math.min(max, Math.max(min, centerY));
}

/** Compact section navigator — left rail, vertically centered. */
export function LandingTableOfContents(): React.JSX.Element {
  const navigationReference = useRef<HTMLElement>(null);
  const previewMountReference = useRef<HTMLDivElement>(null);
  const sectionReferences = useRef<Partial<Record<SectionId, HTMLElement>>>({});
  const activeIdReference = useRef<SectionId>(SECTIONS[0].id);
  const previewIdReference = useRef<SectionId | null>(null);
  const previewMotionReference = useRef<PreviewMotion>("hidden");
  const previewShowTimer = useRef(0);
  const previewHideTimer = useRef(0);
  const previewBoomTimer = useRef(0);
  const [activeId, setActiveId] = useState<SectionId>(SECTIONS[0].id);
  const [isVisible, setIsVisible] = useState<boolean>();
  const [previewId, setPreviewId] = useState<SectionId | null>(null);
  const [previewMotion, setPreviewMotion] = useState<PreviewMotion>("hidden");
  const [previewTop, setPreviewTop] = useState(0);
  const [previewLeft, setPreviewLeft] = useState(0);
  const [previewsEnabled, setPreviewsEnabled] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const placePreview = useCallback((anchor: HTMLElement): void => {
    const linkRect = anchor.getBoundingClientRect();
    const navRect = navigationReference.current?.getBoundingClientRect();
    // TOC expands to w-48 on hover; keep the peek clear of labels mid-transition.
    const railRight = Math.max(navRect?.right ?? 0, 12 * 16);
    setPreviewLeft(railRight + TOC_PREVIEW_GAP);
    setPreviewTop(clampPreviewTop(linkRect.top + linkRect.height / 2));
  }, []);

  const setActiveSection = useCallback((nextActiveId: SectionId): void => {
    if (nextActiveId === activeIdReference.current) {
      return;
    }
    activeIdReference.current = nextActiveId;
    setActiveId(nextActiveId);
  }, []);

  const clearPreviewTimers = useCallback((): void => {
    if (previewShowTimer.current !== 0) {
      window.clearTimeout(previewShowTimer.current);
      previewShowTimer.current = 0;
    }
    if (previewHideTimer.current !== 0) {
      window.clearTimeout(previewHideTimer.current);
      previewHideTimer.current = 0;
    }
    if (previewBoomTimer.current !== 0) {
      window.clearTimeout(previewBoomTimer.current);
      previewBoomTimer.current = 0;
    }
  }, []);

  const finishHidePreview = useCallback((): void => {
    previewIdReference.current = null;
    previewMotionReference.current = "hidden";
    setPreviewId(null);
    setPreviewMotion("hidden");
  }, []);

  const boomPreview = useCallback((): void => {
    if (
      previewIdReference.current === null ||
      previewMotionReference.current === "out"
    ) {
      return;
    }

    clearPreviewTimers();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      finishHidePreview();
      return;
    }

    previewMotionReference.current = "out";
    setPreviewMotion("out");
    previewBoomTimer.current = window.setTimeout(() => {
      previewBoomTimer.current = 0;
      finishHidePreview();
    }, PREVIEW_BOOM_MS);
  }, [clearPreviewTimers, finishHidePreview]);

  const schedulePreview = useCallback(
    (id: SectionId, anchor: HTMLElement): void => {
      if (!previewsEnabled) {
        return;
      }

      clearPreviewTimers();
      placePreview(anchor);

      const reveal = (): void => {
        previewShowTimer.current = 0;
        placePreview(anchor);
        previewIdReference.current = id;
        previewMotionReference.current = "in";
        setPreviewId(id);
        setPreviewMotion("in");
      };

      if (
        previewIdReference.current === id &&
        previewMotionReference.current !== "out"
      ) {
        previewMotionReference.current = "in";
        setPreviewMotion("in");
        return;
      }

      // Interrupt an in-flight boom if the cursor returns.
      if (previewMotionReference.current === "out") {
        previewIdReference.current = id;
        previewMotionReference.current = "in";
        setPreviewId(id);
        setPreviewMotion("in");
        return;
      }

      previewShowTimer.current = window.setTimeout(reveal, PREVIEW_SHOW_DELAY);
    },
    [clearPreviewTimers, placePreview, previewsEnabled],
  );

  const scheduleHidePreview = useCallback((): void => {
    clearPreviewTimers();
    previewHideTimer.current = window.setTimeout(() => {
      previewHideTimer.current = 0;
      boomPreview();
    }, PREVIEW_HIDE_DELAY);
  }, [boomPreview, clearPreviewTimers]);

  useEffect(() => {
    const media = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (min-width: 960px)",
    );
    const sync = (): void => {
      setPreviewsEnabled(media.matches);
      if (!media.matches) {
        finishHidePreview();
      }
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, [finishHidePreview]);

  useEffect(() => {
    for (const section of SECTIONS) {
      const element = document.querySelector(`#${CSS.escape(section.id)}`);
      sectionReferences.current[section.id] =
        element instanceof HTMLElement ? element : undefined;
    }

    let frame = 0;
    let hideTimer = 0;
    let isPointerOverNavigation = false;

    const clearHideTimer = (): void => {
      if (hideTimer !== 0) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
    };
    const hideAfterIdle = (): void => {
      clearHideTimer();
      if (isPointerOverNavigation) {
        return;
      }

      hideTimer = window.setTimeout(() => {
        setIsVisible(false);
        hideTimer = 0;
      }, IDLE_HIDE_DELAY);
    };

    const revealTemporarily = (): void => {
      setIsVisible(true);
      hideAfterIdle();
    };

    const update = (): void => {
      frame = 0;
      if (window.scrollY > SHOW_AFTER_SCROLL) {
        revealTemporarily();
      }

      const marker = window.innerHeight * 0.34;
      let nextActiveId: SectionId = SECTIONS[0].id;

      for (const section of SECTIONS) {
        const element = sectionReferences.current[section.id];
        if (
          element !== undefined &&
          element.getBoundingClientRect().top <= marker
        ) {
          nextActiveId = section.id;
        }
      }

      const isAtPageEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      setActiveSection(isAtPageEnd ? "footer" : nextActiveId);
    };

    const scheduleUpdate = (): void => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    const handlePointerMove = (event: PointerEvent): void => {
      const navigation = navigationReference.current;
      if (navigation === null) {
        return;
      }

      const bounds = navigation.getBoundingClientRect();
      const isOverNavigation =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      const isNearNavigation =
        event.clientX <= POINTER_REVEAL_WIDTH &&
        event.clientY >= bounds.top - POINTER_REVEAL_PADDING &&
        event.clientY <= bounds.bottom + POINTER_REVEAL_PADDING;

      if (isOverNavigation) {
        isPointerOverNavigation = true;
        clearHideTimer();
        setIsVisible(true);
        return;
      }

      if (isPointerOverNavigation) {
        isPointerOverNavigation = false;
        hideAfterIdle();
      }

      if (isNearNavigation) {
        revealTemporarily();
      }
    };

    const handleResize = (): void => {
      invalidateTocSectionPreviews();
      scheduleUpdate();
    };

    update();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      clearHideTimer();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [setActiveSection]);

  useEffect(() => {
    if (!previewsEnabled || isVisible !== true) {
      clearPreviewTimers();
      finishHidePreview();
      return;
    }
    warmTocSectionPreviews(SECTIONS.map((section) => section.id));
  }, [clearPreviewTimers, finishHidePreview, isVisible, previewsEnabled]);

  useLayoutEffect(() => {
    const mount = previewMountReference.current;
    if (mount === null) {
      return;
    }

    mount.replaceChildren();
    if (previewId === null) {
      return;
    }

    const stage = getTocSectionPreview(previewId);
    if (stage === null) {
      return;
    }
    mount.append(stage);

    return () => {
      if (stage.parentElement === mount) {
        mount.removeChild(stage);
      }
    };
  }, [previewId]);

  useEffect(() => {
    if (previewId === null || previewMotion === "out") {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const navigation = navigationReference.current;
      if (navigation !== null && navigation.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest("[data-landing-toc-preview]") !== null
      ) {
        return;
      }
      boomPreview();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [boomPreview, previewId, previewMotion]);

  useEffect(() => {
    return () => {
      clearPreviewTimers();
    };
  }, [clearPreviewTimers]);

  const scrollToSection = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: SectionId,
  ): void => {
    const cached = sectionReferences.current[id];
    const queried = document.querySelector(`#${CSS.escape(id)}`);
    const target = cached ?? (queried instanceof HTMLElement ? queried : null);
    if (target == null) {
      return;
    }

    event.preventDefault();
    boomPreview();
    setActiveSection(id);
    event.currentTarget.blur();
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${id}`);
  };

  const previewSection =
    previewId === null
      ? null
      : SECTIONS.find((section) => section.id === previewId);
  const previewIndex =
    previewSection === null || previewSection === undefined
      ? -1
      : SECTIONS.indexOf(previewSection);
  const previewMounted =
    previewSection !== null && previewSection !== undefined;
  const previewBooming = previewMotion === "out";

  return (
    <nav
      ref={navigationReference}
      aria-label="Spis treści strony"
      aria-hidden={isVisible !== true}
      className={cn(
        "group/toc fixed top-1/2 left-0 z-[100] w-11 -translate-y-1/2 py-1.5",
        "transition-[width,opacity,transform] duration-300 ease-out hover:w-48 has-[:focus-visible]:w-48 motion-reduce:transition-none",
        isVisible === true
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-2 opacity-0",
      )}
    >
      <ol>
        {SECTIONS.map((section, index) => {
          const isActive = section.id === activeId;

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                tabIndex={isVisible === true ? 0 : -1}
                onClick={(event) => {
                  scrollToSection(event, section.id);
                }}
                onPointerEnter={(event) => {
                  schedulePreview(section.id, event.currentTarget);
                }}
                onPointerLeave={scheduleHidePreview}
                onFocus={(event) => {
                  schedulePreview(section.id, event.currentTarget);
                }}
                onBlur={scheduleHidePreview}
                className={cn(
                  "group/link text-muted-foreground hover:text-foreground flex h-5 items-center justify-start text-[0.72rem] transition-colors",
                  FOCUS_RING,
                  isActive && "text-foreground font-bold",
                )}
              >
                <span className="group-hover/link:bg-background/70 group-focus-visible/link:bg-background/70 flex w-fit max-w-full items-center justify-start gap-0 rounded-r-sm py-0.5 pr-1.5 pl-1 transition-[gap,background-color] duration-200 group-hover/link:gap-2 group-hover/link:backdrop-blur-[6px] group-focus-visible/link:gap-2 group-focus-visible/link:backdrop-blur-[6px] motion-reduce:transition-none">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-px shrink-0 transition-[width,background-color,opacity] duration-200 motion-reduce:transition-none",
                      isActive
                        ? "bg-primary w-7 opacity-80 group-hover/link:w-9 group-hover/link:opacity-100 group-focus-visible/link:w-9 group-focus-visible/link:opacity-100"
                        : "bg-foreground group-focus-visible/link:bg-primary group-hover/link:bg-primary w-3 opacity-15 group-hover/link:w-8 group-hover/link:opacity-80 group-focus-visible/link:w-8 group-focus-visible/link:opacity-80",
                    )}
                  />
                  <span className="font-landing-mono w-0 overflow-hidden text-[0.58rem] tabular-nums opacity-0 transition-[width,opacity] duration-200 group-hover/link:w-4 group-hover/link:opacity-45 group-focus-visible/link:w-4 group-focus-visible/link:opacity-45 motion-reduce:transition-none">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="max-w-0 -translate-x-2 overflow-hidden text-left whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-200 group-hover/link:max-w-32 group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:max-w-32 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100 motion-reduce:transition-none">
                    {section.label}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      {portalReady &&
        previewsEnabled &&
        previewMounted &&
        createPortal(
          <div
            aria-hidden="true"
            data-landing-toc-preview=""
            onPointerEnter={() => {
              if (!previewBooming) {
                clearPreviewTimers();
              }
            }}
            onPointerLeave={scheduleHidePreview}
            className="pointer-events-none fixed z-[120]"
            style={{
              top: previewTop,
              left: previewLeft,
              width: TOC_PREVIEW_WIDTH,
              transform: "translateY(-50%)",
              pointerEvents: previewBooming ? "none" : "auto",
            }}
          >
            <div
              className={cn(
                "relative",
                previewBooming ? "lp-toc-preview-boom" : "lp-toc-preview-in",
              )}
            >
              <div className="border-border bg-background relative rounded-xl border p-2 shadow-[0_18px_50px_-28px_oklch(0_0_0/0.55)]">
                <span className="border-border bg-background absolute top-1/2 -left-[6px] size-2.5 -translate-y-1/2 rotate-45 border-t border-l" />
                <div
                  className="border-border bg-muted/30 relative overflow-hidden rounded-lg border"
                  style={{
                    width: TOC_PREVIEW_INNER_WIDTH,
                    height: TOC_PREVIEW_INNER_HEIGHT,
                  }}
                >
                  <div
                    ref={previewMountReference}
                    className="absolute top-0 left-0 origin-top-left"
                  />
                </div>
                <div className="mt-2 flex items-center gap-2 px-0.5">
                  <span className="font-landing-mono text-muted-foreground text-[0.62rem] tabular-nums">
                    {previewIndex >= 0
                      ? String(previewIndex + 1).padStart(2, "0")
                      : "00"}
                  </span>
                  <span className="font-landing text-foreground truncate text-[0.78rem] font-semibold tracking-[-0.02em]">
                    {previewSection?.label ?? ""}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </nav>
  );
}
