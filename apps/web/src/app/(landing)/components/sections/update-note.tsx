import { Caveat } from "next/font/google";
import Image from "next/image";

import { cn } from "@/lib/utils";

import { LANDING_UPDATE } from "../landing-content";

const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

export function UpdateNote(): React.JSX.Element {
  return (
    <article
      aria-labelledby="landing-update-heading"
      className="relative isolate mt-10 max-w-[34rem] drop-shadow-[0_8px_14px_rgb(0_0_0/0.12)] sm:mt-12"
    >
      <div className="relative overflow-hidden bg-[#f4f1e8] px-7 pt-8 pb-12 text-[#252b37] [clip-path:polygon(0_0,calc(100%-2.5rem)_0,100%_2.5rem,100%_100%,0_100%)] sm:px-10 sm:pt-10 sm:pb-14 lg:px-8 xl:px-10">
        <Image
          src="/images/landing/update-paper.webp"
          alt=""
          fill
          sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) 544px, (max-width: 1535px) 36vw, 544px"
          className="pointer-events-none object-fill select-none"
        />
        <h3 id="landing-update-heading" className="relative pr-5">
          <span
            className={cn(
              caveat.className,
              "block text-4xl leading-none text-[#315caa]",
            )}
          >
            {LANDING_UPDATE.heading}
          </span>
          <time
            dateTime={LANDING_UPDATE.date}
            className="mt-3 block text-xs font-semibold tracking-[0.08em] uppercase"
          >
            {LANDING_UPDATE.label}
          </time>
        </h3>
        <ul className="relative mt-6 space-y-4 text-[0.9rem] leading-[1.6]">
          {LANDING_UPDATE.changes.map((change) => (
            <li key={change.title}>
              <span className="font-bold">{change.title}.</span> {change.text}
            </li>
          ))}
        </ul>
        <p
          className={cn(
            caveat.className,
            "relative mt-7 max-w-[85%] -rotate-2 text-2xl leading-tight text-[#315caa]",
          )}
        >
          {LANDING_UPDATE.note}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 size-10 bg-linear-to-tr from-[#c8c4b7] via-[#e5e1d5] to-[#f7f5ee] shadow-[-3px_4px_5px_rgb(0_0_0/0.12)] [clip-path:polygon(0_0,0_100%,100%_100%)]"
      />
    </article>
  );
}
