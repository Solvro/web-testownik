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
 * The hero visual below `lg`: an iPhone drawn entirely in CSS (see `.lp-iphone`
 * in landing.css) running the same live quiz as the desktop stage. No image,
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
        <div className="lp-iphone origin-top-left [scale:var(--lp-phone-scale)]">
          <div className="lp-iphone-frame">
            <div ref={skipSequentialFocus} className="lp-iphone-screen">
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
          <div aria-hidden="true" className="lp-iphone-island" />
          <div aria-hidden="true" className="lp-iphone-sensors" />
          <div aria-hidden="true" className="lp-iphone-buttons" />
          <div aria-hidden="true" className="lp-iphone-power" />
          <div aria-hidden="true" className="lp-iphone-bands" />
        </div>
      </div>
      <MobileHeroBadges />
    </div>
  );
}
