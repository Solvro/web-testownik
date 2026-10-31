"use client";

import { useEffect, useRef, useState } from "react";

import { perks as snapshot } from "../../data/perks";
import { PERKS_COPY } from "../landing-content";

const format = new Intl.NumberFormat("pl-PL");
const targets = [
  snapshot.studentsCount,
  snapshot.offersCount,
  snapshot.yearlySavingsPln,
];

export function PerksStats(): React.JSX.Element {
  const reference = useRef<HTMLDListElement>(null);
  const [values, setValues] = useState([0, 0, 0]);

  useEffect(() => {
    const node = reference.current;
    if (node === null) {
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let complete = false;
    let elapsed = 0;
    let lastFrame: number | undefined;
    let frame = 0;
    let studentsTimer: ReturnType<typeof setInterval> | undefined;
    let offersTimer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      cancelAnimationFrame(frame);
      clearInterval(studentsTimer);
      clearInterval(offersTimer);
      lastFrame = undefined;
    };
    const startIncrements = () => {
      studentsTimer = setInterval(() => {
        setValues(([students, offers, savings]) => [
          students + 1,
          offers,
          savings,
        ]);
      }, 4000);
      offersTimer = setInterval(() => {
        setValues(([students, offers, savings]) => [
          students,
          offers + 1,
          savings,
        ]);
      }, 28_000);
    };
    const tick = (now: number) => {
      elapsed += lastFrame === undefined ? 0 : now - lastFrame;
      lastFrame = now;
      const progress = Math.min(elapsed / 1800, 1);
      const eased = 1 - (1 - progress) ** 5;
      setValues(targets.map((target) => Math.round(target * eased)));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        complete = true;
        startIncrements();
      }
    };
    const start = () => {
      stop();
      if (!visible || document.hidden) {
        return;
      }
      if (reducedMotion.matches) {
        complete = true;
        setValues(targets);
      } else if (complete) {
        startIncrements();
      } else {
        frame = requestAnimationFrame(tick);
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
        start();
      },
      { threshold: 0.5 },
    );
    // State updates respond to viewport events, not effect initialization.
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state
    observer.observe(node);
    document.addEventListener("visibilitychange", start);
    reducedMotion.addEventListener("change", start);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", start);
      reducedMotion.removeEventListener("change", start);
    };
  }, []);

  const captions = [
    PERKS_COPY.studentsCaption,
    PERKS_COPY.offersCaption(String(snapshot.maxDiscountPct)),
    PERKS_COPY.savingsCaption,
  ];
  return (
    <dl
      ref={reference}
      className="grid grid-cols-3 items-start gap-4 border-t border-(--perk-border) pt-6"
    >
      {captions.map((caption, index) => (
        <div key={caption} className="flex min-w-0 flex-col-reverse gap-1">
          <dt className="text-[13px] leading-snug text-(--perk-muted)">
            {caption}
          </dt>
          <dd className="text-[1.375rem] leading-[1.1] font-bold tracking-[-0.035em] whitespace-nowrap tabular-nums lg:text-[2.25rem]">
            <span className="sr-only">
              {index === 2 ? "do " : ""}
              {format.format(targets[index])}
              {index === 2 ? " zł" : ""}
            </span>
            <span aria-hidden="true">
              {index === 2 ? (
                <span className="mr-1 text-[0.55em] font-medium tracking-normal">
                  do
                </span>
              ) : null}
              {format.format(values[index])}
              {index === 2 ? "\u00A0zł" : ""}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
