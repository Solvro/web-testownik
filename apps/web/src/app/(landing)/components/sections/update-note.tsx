import { cn } from "@/lib/utils";

import { Peel } from "../../canvasui/Peel";
import { LANDING_UPDATE } from "../landing-content";
import { FOCUS_RING } from "../ui/focus";
import { handwritingClassName } from "../ui/handwriting";

export function UpdateNote(): React.JSX.Element {
  return (
    <article
      aria-labelledby="landing-update-heading"
      className="mt-10 max-w-sm px-2"
    >
      <Peel
        reverse
        corner
        side="bottom"
        mode="hover"
        reveal={36}
        curl={34}
        bow={12}
        bulge={0}
        shine={0}
        shade={0.3}
        className="lp-update-note"
        overlay={
          <div
            className={cn(
              handwritingClassName,
              "lp-update-paper flex h-full flex-col px-6 pt-5 pb-14 text-[#253b60] sm:px-7",
            )}
          >
            <h3
              id="landing-update-heading"
              className="text-[2.1rem] leading-none font-bold tracking-tight"
            >
              Ostatnie zmiany
            </h3>
            <p className="mt-3 text-[1.45rem] leading-[1.12] font-semibold">
              {LANDING_UPDATE.title}
            </p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 text-[1.25rem] leading-[1.22] marker:text-[#80722c]">
              {LANDING_UPDATE.changes.map((change) => (
                <li key={change.title}>{change.summary}</li>
              ))}
            </ul>
            <button
              type="button"
              role="link"
              tabIndex={0}
              aria-disabled="true"
              className={cn(
                "lp-ink-link mt-3 inline-flex min-h-11 w-fit cursor-pointer items-center rounded-sm text-[1.35rem] font-semibold",
                FOCUS_RING,
              )}
            >
              Zobacz więcej
            </button>
          </div>
        }
      >
        <div className="lp-update-sheet" />
      </Peel>
    </article>
  );
}
