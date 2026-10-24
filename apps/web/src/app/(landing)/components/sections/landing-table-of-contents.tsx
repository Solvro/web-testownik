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

import { LANDING_SECTIONS } from "../landing-sections";
import { FOCUS_RING } from "../ui/focus";
import {
  TOC_PREVIEW_GAP,
  TOC_PREVIEW_INNER_HEIGHT,
  TOC_PREVIEW_INNER_WIDTH,
  TOC_PREVIEW_WIDTH,
  attachTocPreviewHost,
  invalidateTocSectionPreviews,
  setTocPreviewRailVisible,
  showTocSectionPreview,
  warmTocSectionPreviews,
} from "./toc-section-preview";

const SECTIONS = LANDING_SECTIONS;

type SectionId = (typeof SECTIONS)[number]["id"];

const SHOW_AFTER_SCROLL = 160;
const IDLE_HIDE_DELAY = 2800;
const POINTER_REVEAL_WIDTH = 88;
const POINTER_REVEAL_PADDING = 24;
/** Short grace period so moving between rail items does not flicker. */
const PREVIEW_HIDE_DELAY = 120;
/** Let a resize settle before rebuilding peeks against the new layout. */
const PREVIEW_REWARM_DELAY = 400;
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

/** Compact rail: collapsed links fit inside the sections' 24px left gutter. */
export function LandingTableOfContents(): React.JSX.Element {
  const navigationReference = useRef<HTMLElement>(null);
  const previewMountReference = useRef<HTMLDivElement>(null);
  const sectionReferences = useRef<Partial<Record<SectionId, HTMLElement>>>({});
  const activeIdReference = useRef<SectionId>(SECTIONS[0].id);
  const previewIdReference = useRef<SectionId | null>(null);
  const previewMotionReference = useRef<PreviewMotion>("hidden");
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
    // Keep the peek clear of labels while their width animates on hover.
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

      // Peeks are pre-built during idle, so showing one is only a mount:
      // reveal on the same event. This also lets a returning cursor
      // interrupt an in-flight boom.
      clearPreviewTimers();
      placePreview(anchor);
      previewIdReference.current = id;
      previewMotionReference.current = "in";
      setPreviewId(id);
      setPreviewMotion("in");
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
    if (!previewsEnabled) {
      return;
    }

    let cancelWarm: (() => void) | null = null;
    let rewarmTimer = 0;

    const warm = (): void => {
      cancelWarm?.();
      cancelWarm = warmTocSectionPreviews(SECTIONS);
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
    };
  }, [previewsEnabled]);

  useEffect(() => {
    for (const section of SECTIONS) {
      const element = document.querySelector(`#${CSS.escape(section.id)}`);
      sectionReferences.current[section.id] =
        element instanceof HTMLElement ? element : undefined;
    }

    let frame = 0;
    let hideTimer = 0;
    let isPointerOverNavigation = false;
    let sectionTops: { id: SectionId; top: number }[] = [];
    let pageHeight = 0;

    const clearHideTimer = (): void => {
      if (hideTimer !== 0) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
    };
    const hideAfterIdle = (focusIsLeaving = false): void => {
      clearHideTimer();
      if (
        isPointerOverNavigation ||
        (!focusIsLeaving &&
          navigationReference.current?.contains(document.activeElement) ===
            true)
      ) {
        return;
      }

      hideTimer = window.setTimeout(() => {
        setIsVisible(false);
        clearPreviewTimers();
        finishHidePreview();
        hideTimer = 0;
      }, IDLE_HIDE_DELAY);
    };

    const revealTemporarily = (): void => {
      setIsVisible(true);
      hideAfterIdle();
    };

    const handleFocusIn = (): void => {
      clearHideTimer();
      setIsVisible(true);
    };
    const handleFocusOut = (event: FocusEvent): void => {
      if (
        event.relatedTarget instanceof Node &&
        navigationReference.current?.contains(event.relatedTarget) === true
      ) {
        return;
      }
      // During focusout the browser can still report the departing link as
      // active. The related target above already tells us focus is leaving.
      hideAfterIdle(true);
    };

    const update = (): void => {
      frame = 0;
      if (window.scrollY > SHOW_AFTER_SCROLL) {
        revealTemporarily();
      }

      const marker = window.innerHeight * 0.34;
      const scrollTop = window.scrollY;
      let nextActiveId: SectionId = SECTIONS[0].id;

      for (const section of sectionTops) {
        if (section.top - scrollTop <= marker) {
          nextActiveId = section.id;
        }
      }

      const isAtPageEnd = window.innerHeight + scrollTop >= pageHeight - 2;
      setActiveSection(isAtPageEnd ? "footer" : nextActiveId);
    };

    const scheduleUpdate = (): void => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    // Section sizes change when lazy content, fonts or an accordion settles.
    // Cache document offsets then, rather than measuring six sections after
    // the hero has changed its styles on every scroll frame.
    const measureSections = (): void => {
      const scrollTop = window.scrollY;
      sectionTops = SECTIONS.flatMap(({ id }) => {
        const element = sectionReferences.current[id];
        return element === undefined
          ? []
          : [{ id, top: element.getBoundingClientRect().top + scrollTop }];
      });
      pageHeight = document.documentElement.scrollHeight;
      scheduleUpdate();
    };
    const sizeObserver = new ResizeObserver(measureSections);
    for (const element of Object.values(sectionReferences.current)) {
      sizeObserver.observe(element);
    }
    sizeObserver.observe(document.body);

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
      const isOverPreview =
        event.target instanceof Element &&
        event.target.closest("[data-landing-toc-preview]") !== null;
      const isNearNavigation =
        event.clientX <= POINTER_REVEAL_WIDTH &&
        event.clientY >= bounds.top - POINTER_REVEAL_PADDING &&
        event.clientY <= bounds.bottom + POINTER_REVEAL_PADDING;

      if (isOverNavigation || isOverPreview) {
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

    measureSections();
    const navigation = navigationReference.current;
    navigation?.addEventListener("focusin", handleFocusIn);
    navigation?.addEventListener("focusout", handleFocusOut);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", measureSections);
    window.addEventListener("pageshow", measureSections);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    return () => {
      navigation?.removeEventListener("focusin", handleFocusIn);
      navigation?.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", measureSections);
      window.removeEventListener("pageshow", measureSections);
      sizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      clearHideTimer();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [clearPreviewTimers, finishHidePreview, setActiveSection]);

  const previewHostReady = portalReady && previewsEnabled;

  useLayoutEffect(() => {
    const mount = previewMountReference.current;
    if (!previewHostReady || mount === null) {
      return;
    }
    return attachTocPreviewHost(mount);
  }, [previewHostReady]);

  useLayoutEffect(() => {
    if (!previewHostReady) {
      return;
    }
    const section =
      previewId === null
        ? null
        : (SECTIONS.find((candidate) => candidate.id === previewId) ?? null);
    showTocSectionPreview(section);
  }, [previewHostReady, previewId]);

  // Dirty peeks are re-cloned in idle time only while the rail is out, so a
  // hover usually finds a current one already parked.
  useEffect(() => {
    setTocPreviewRailVisible(previewsEnabled && isVisible === true);
  }, [isVisible, previewsEnabled]);

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
      if (navigation?.contains(target) === true) {
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
  const previewActive = previewMounted && !previewBooming;

  return (
    <nav
      ref={navigationReference}
      aria-label="Spis treści strony"
      aria-hidden={isVisible !== true}
      className={cn(
        "group/toc pointer-events-none fixed top-1/2 left-0 z-[100] hidden w-max -translate-y-1/2 py-1.5 md:block",
        "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        isVisible === true
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-2 opacity-0",
      )}
    >
      <ol>
        {SECTIONS.map((section, index) => {
          const isActive = section.id === activeId;
          const isPreviewActive = previewActive && section.id === previewId;

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
                  "group/link text-muted-foreground hover:text-foreground flex h-5 w-fit items-center justify-start text-[0.72rem] transition-colors",
                  isVisible === true && "pointer-events-auto",
                  FOCUS_RING,
                  isActive && "text-foreground font-bold",
                )}
              >
                <span
                  className={cn(
                    "group-hover/link:bg-background/90 group-focus-visible/link:bg-background/90 flex w-fit max-w-full items-center justify-start gap-0 rounded-r-sm py-0.5 pr-1.5 pl-1 transition-[gap,background-color] duration-200 group-hover/link:gap-2 group-focus-visible/link:gap-2 motion-reduce:transition-none",
                    isPreviewActive && "bg-background/90 gap-2",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-px shrink-0 transition-[width,background-color,opacity] duration-200 motion-reduce:transition-none",
                      isActive
                        ? "bg-primary w-3 opacity-80 group-hover/link:w-9 group-hover/link:opacity-100 group-focus-visible/link:w-9 group-focus-visible/link:opacity-100"
                        : "bg-foreground group-focus-visible/link:bg-primary group-hover/link:bg-primary w-3 opacity-15 group-hover/link:w-8 group-hover/link:opacity-80 group-focus-visible/link:w-8 group-focus-visible/link:opacity-80",
                      isPreviewActive &&
                        (isActive
                          ? "w-9 opacity-100"
                          : "bg-primary w-8 opacity-80"),
                    )}
                  />
                  <span
                    className={cn(
                      "w-0 overflow-hidden text-[0.58rem] tabular-nums opacity-0 transition-[width,opacity] duration-200 group-hover/link:w-4 group-hover/link:opacity-45 group-focus-visible/link:w-4 group-focus-visible/link:opacity-45 motion-reduce:transition-none",
                      isPreviewActive && "w-4 opacity-45",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "max-w-0 -translate-x-2 overflow-hidden text-left whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-200 group-hover/link:max-w-32 group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:max-w-32 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100 motion-reduce:transition-none",
                      isPreviewActive && "max-w-32 translate-x-0 opacity-100",
                    )}
                  >
                    {section.label}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      {/*
       * Always mounted while previews are enabled: the card's screen hosts
       * every pre-built peek, so a hover flips visibility instead of
       * inserting DOM.
       */}
      {previewHostReady
        ? createPortal(
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
                // Opacity, not visibility: visibility is inherited, so
                // toggling it would restyle every parked clone.
                opacity: previewMounted ? 1 : 0,
                pointerEvents: previewActive ? "auto" : "none",
              }}
            >
              <div
                className={cn(
                  "relative motion-reduce:animate-none",
                  // Arrive soft, leave with a quick pop; the pop's two burst
                  // rings are `.lp-toc-preview-boom` pseudo-elements.
                  previewMounted &&
                    (previewBooming
                      ? "lp-toc-preview-boom pointer-events-none animate-[lp-toc-preview-boom_360ms_cubic-bezier(0.2,0.8,0.2,1)_both]"
                      : "animate-[lp-toc-preview-in_220ms_cubic-bezier(0.22,1,0.36,1)_both]"),
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
                  {/*
                   * Every caption is rendered and stacked; only class flips on
                   * hover, so hovering never inserts nodes into the document
                   * (see `toc-section-preview.ts` on `:has()` invalidation).
                   */}
                  <div className="mt-2 grid px-0.5">
                    {SECTIONS.map((section, index) => (
                      <div
                        key={section.id}
                        className={cn(
                          "col-start-1 row-start-1 flex min-w-0 items-center gap-2",
                          index !== previewIndex && "invisible",
                        )}
                      >
                        <span className="text-muted-foreground text-[0.62rem] tabular-nums">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground truncate text-[0.78rem] font-semibold tracking-[-0.02em]">
                          {section.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </nav>
  );
}
