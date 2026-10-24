"use client";

import { Suspense, lazy } from "react";

import { cn } from "@/lib/utils";

import { useIsCompactViewport } from "../hooks/use-prefers-reduced-motion";
import { MobileHeroBadges } from "./hero-badges";

const HeroPhoneScreen = lazy(async () => {
  const loaded = await import("./hero-phone-screen");
  return { default: loaded.HeroPhoneScreen };
});

const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, [tabindex], [contenteditable]:not([contenteditable="false"])';

/**
 * Keeps the live preview out of the page's Tab order while leaving it usable
 * by pointer and touch: every focusable descendant, including ones the quiz
 * mounts or re-renders later, gets `tabindex="-1"`. Those stay focusable on
 * click, so a tapped control behaves normally; Tab simply never lands inside.
 * A React 19 ref callback, so the observer goes away with the element.
 */
function skipSequentialFocus(
  root: HTMLElement | null,
): (() => void) | undefined {
  if (root === null) {
    return undefined;
  }
  const demote = (): void => {
    for (const element of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
      if (element.tabIndex >= 0) {
        element.tabIndex = -1;
      }
    }
  };
  demote();
  const observer = new MutationObserver(demote);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["tabindex", "href", "contenteditable"],
  });
  return () => {
    observer.disconnect();
  };
}

const blankScreen = (
  <div aria-hidden="true" className="bg-background size-full" />
);

/**
 * The hero visual below `lg`: an iPhone drawn entirely in CSS (the antenna
 * lines, sensors and volume buttons are the `.lp-iphone-*` pseudo-elements in
 * landing.css) running the same live quiz as the desktop stage. No image,
 * no model, no WebGL. The scroll choreography is a CSS scroll-driven animation
 * on `.lp-hero-phone` and `.lp-hero-chip`.
 *
 * The frame is a fixed 428 × 879 px device scaled per breakpoint, so the
 * screen keeps the 390 px logical width the quiz surface is designed for —
 * the same width the desktop iPhone renders at.
 */
export function HeroPhone({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  // False on the server and on desktop: neither downloads the quiz surface.
  const isCompact = useIsCompactViewport();

  return (
    <div
      className={cn(
        "relative mx-auto mt-10 h-[calc(879px*var(--lp-phone-scale))] w-[calc(428px*var(--lp-phone-scale))]",
        "[--lp-phone-scale:0.54] min-[375px]:[--lp-phone-scale:0.57] min-[390px]:[--lp-phone-scale:0.6] min-[414px]:[--lp-phone-scale:0.63] min-[430px]:[--lp-phone-scale:0.66] sm:[--lp-phone-scale:0.72] md:[--lp-phone-scale:0.78]",
        className,
      )}
    >
      <div
        role="group"
        aria-label="iPhone z quizem w Testowniku"
        className="lp-hero-phone absolute inset-0"
      >
        <div
          className={cn(
            "relative h-[879px] w-[428px] origin-top-left [scale:var(--lp-phone-scale)]",
            // Silver in light, space black in dark; the screen follows the
            // page theme on its own.
            "[--lp-iphone-edge:#c8cacb] [--lp-iphone-rim:#e2e3e4] dark:[--lp-iphone-edge:#5c5956] dark:[--lp-iphone-rim:#76726f]",
          )}
        >
          <div className="box-border h-[879px] w-[428px] rounded-[68px] border border-(--lp-iphone-edge) bg-[#010101] p-[18px] shadow-[inset_0_0_4px_2px_white,inset_0_0_0_6px_var(--lp-iphone-rim),0_2.6rem_4rem_-1.6rem_rgb(0_0_0/38%)]">
            {/* Its own stacking context so the screen's z-indexed UI stays under the island. */}
            <div
              ref={skipSequentialFocus}
              className="bg-background relative isolate h-[841px] w-[390px] overflow-hidden rounded-[49px]"
            >
              {isCompact ? (
                <Suspense fallback={blankScreen}>
                  <HeroPhoneScreen />
                </Suspense>
              ) : (
                blankScreen
              )}
            </div>
          </div>
          <div aria-hidden="true" className="lp-iphone-stripe" />
          {/* Dynamic Island. */}
          <div
            aria-hidden="true"
            className="absolute top-[29px] left-1/2 -ml-[60px] h-[35px] w-[120px] rounded-[20px] bg-[#010101]"
          />
          <div aria-hidden="true" className="lp-iphone-sensors" />
          {/* Action button; volume up and down are its pseudo-elements. */}
          <div
            aria-hidden="true"
            className="lp-iphone-buttons absolute top-[115px] -left-[2px] h-8 w-[3px] rounded-[2px] bg-(--lp-iphone-edge)"
          />
          <div
            aria-hidden="true"
            className="absolute top-[200px] -right-[2px] h-[100px] w-[3px] rounded-[2px] bg-(--lp-iphone-edge)"
          />
          <div aria-hidden="true" className="lp-iphone-bands" />
        </div>
      </div>
      <MobileHeroBadges />
    </div>
  );
}
