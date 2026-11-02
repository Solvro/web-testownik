"use client";

import { useEffect, useRef } from "react";

import { perks as snapshot } from "../../data/perks";
import { PERKS_COPY } from "../landing-content";

const format = new Intl.NumberFormat("pl-PL");
const stats = [
  { value: snapshot.studentsCount, caption: PERKS_COPY.studentsCaption },
  {
    value: snapshot.offersCount,
    caption: PERKS_COPY.offersCaption(String(snapshot.maxDiscountPct)),
  },
  { value: snapshot.yearlySavingsPln, caption: PERKS_COPY.savingsCaption },
];

export function PerksStats(): React.JSX.Element {
  const reference = useRef<HTMLDListElement>(null);

  useEffect(() => {
    const list = reference.current;
    if (list === null) {
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const counters = [
      ...list.querySelectorAll<HTMLElement>("[data-perk-count]"),
    ];
    let frame = 0;
    const finish = (): void => {
      cancelAnimationFrame(frame);
      for (const counter of counters) {
        counter.textContent = counter.dataset.perkCount ?? "";
      }
    };
    if (motion.matches || typeof IntersectionObserver === "undefined") {
      return;
    }
    for (const counter of counters) {
      counter.textContent = "0";
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number): void => {
          const progress = Math.max(0, Math.min((now - start) / 1200, 1));
          const eased = 1 - (1 - progress) ** 3;
          for (const [index, counter] of counters.entries()) {
            counter.textContent = format.format(
              Math.round(stats[index].value * eased),
            );
          }
          if (progress < 1) {
            frame = requestAnimationFrame(tick);
          }
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    const handleMotionChange = (): void => {
      if (motion.matches) {
        observer.disconnect();
        finish();
      }
    };
    observer.observe(list);
    motion.addEventListener("change", handleMotionChange);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", handleMotionChange);
      finish();
    };
  }, []);

  return (
    <dl
      ref={reference}
      className="grid grid-cols-[1.4fr_1fr_1fr] gap-x-3 border-t border-(--perk-border) pt-6 sm:gap-x-5"
    >
      {stats.map(({ value, caption }, index) => (
        <div
          key={caption}
          className="flex min-w-0 flex-col-reverse justify-end gap-2 border-l border-(--perk-border) pl-3 first:border-0 first:pl-0 sm:pl-5"
        >
          <dt className="text-[12px] leading-snug text-(--perk-muted) sm:text-[13px]">
            {caption}
          </dt>
          <dd className="text-[clamp(1.25rem,4.8vw,2.75rem)] leading-none font-bold tracking-[-0.05em] whitespace-nowrap tabular-nums lg:text-[clamp(1.5rem,2.6vw,2.75rem)]">
            {index === 2 ? (
              <span className="text-[0.45em] font-medium tracking-normal text-(--perk-muted)">
                {"do\u00A0"}
              </span>
            ) : null}
            <span className="inline-grid">
              {/* Reserve the final width and expose a stable value to screen readers. */}
              <span className="col-start-1 row-start-1 opacity-0">
                {format.format(value)}
              </span>
              <span
                aria-hidden="true"
                data-perk-count={format.format(value)}
                className="col-start-1 row-start-1"
              >
                {format.format(value)}
              </span>
            </span>
            {index === 2 ? (
              <span className="text-[0.45em] font-medium tracking-normal">
                {"\u00A0zł"}
              </span>
            ) : (
              <span className="ml-0.5 inline-block align-top text-[0.65em] leading-none font-semibold text-(--perk-accent-ink)">
                +
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
