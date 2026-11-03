"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { LANDING_SECTIONS } from "../../landing-sections";
import type { LandingSectionId } from "../../landing-sections";
import { followLandingSectionLink } from "../../scroll-to-section";
import { FOCUS_RING } from "../../ui/focus";
import {
  TOC_PREVIEW_INNER_HEIGHT,
  TOC_PREVIEW_INNER_WIDTH,
  TOC_PREVIEW_WIDTH,
} from "./toc-section-preview";
import { useTocPreview } from "./use-toc-preview";
import { useTocRail } from "./use-toc-rail";

const SECTIONS = LANDING_SECTIONS;

/** Compact rail: collapsed links fit inside the sections' 24px left gutter. */
export function LandingTableOfContents(): React.JSX.Element {
  const navigationReference = useRef<HTMLElement>(null);
  const {
    enabled: previewsEnabled,
    preview,
    mountReference: previewMountReference,
    show: schedulePreview,
    scheduleHide: scheduleHidePreview,
    holdOpen: holdPreviewOpen,
    boom: boomPreview,
    hide: hidePreview,
  } = useTocPreview(navigationReference);
  const { activeId, setActiveId, isVisible } = useTocRail(
    navigationReference,
    hidePreview,
  );

  const followLink = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: LandingSectionId,
  ): void => {
    if (followLandingSectionLink(event, id) !== null) {
      boomPreview();
      setActiveId(id);
    }
  };

  const previewIndex = SECTIONS.findIndex(
    (section) => section.id === preview.id,
  );
  const previewMounted = previewIndex !== -1;
  const previewBooming = preview.motion === "out";
  const previewActive = previewMounted && !previewBooming;

  return (
    <nav
      ref={navigationReference}
      aria-label="Spis treści strony"
      className={cn(
        "group/toc pointer-events-none fixed top-1/2 left-0 z-[100] hidden w-max -translate-y-1/2 py-1.5 md:block",
        "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        // Idle hiding is visual only: the links stay tabbable and in the
        // accessibility tree, and focusing one brings the rail back.
        isVisible
          ? "translate-x-0 opacity-100"
          : "pointer-events-none -translate-x-2 opacity-0 focus-within:translate-x-0 focus-within:opacity-100",
      )}
    >
      <ol>
        {SECTIONS.map((section, index) => {
          const isActive = section.id === activeId;
          const isPreviewActive = previewActive && section.id === preview.id;

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(event) => {
                  followLink(event, section.id);
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
                  isVisible && "pointer-events-auto",
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
      {previewsEnabled
        ? createPortal(
            <div
              aria-hidden="true"
              data-landing-toc-preview=""
              onPointerEnter={holdPreviewOpen}
              onPointerLeave={scheduleHidePreview}
              className="pointer-events-none fixed z-[120]"
              style={{
                top: preview.top,
                left: preview.left,
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
                  <svg
                    aria-hidden="true"
                    className="text-border absolute top-1/2 -left-[10px] z-10 h-4 w-[11px] -translate-y-1/2 overflow-visible"
                    viewBox="0 0 11 16"
                  >
                    <path
                      d="M11 0 1 8 11 16"
                      fill="var(--background)"
                      stroke="currentColor"
                      strokeLinejoin="round"
                    />
                  </svg>
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
