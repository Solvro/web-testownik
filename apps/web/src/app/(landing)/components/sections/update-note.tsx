import { cn } from "@/lib/utils";

import { LANDING_UPDATE, REPOSITORY_URL } from "../landing-content";
import { FOCUS_RING } from "../ui/focus";
import { HandNote, MarginSketch } from "../ui/hand-note";

export function UpdateNote(): React.JSX.Element {
  return (
    <article
      aria-labelledby="landing-update-heading"
      className="relative mt-8 max-w-sm"
    >
      <h3
        id="landing-update-heading"
        className="text-primary text-xl font-semibold"
      >
        {LANDING_UPDATE.heading}
      </h3>
      <HandNote className="mt-3 text-[1.35rem]!">
        <time dateTime={LANDING_UPDATE.date}>{LANDING_UPDATE.label}</time>
        <span className="ml-3">/ ostatnie zmiany</span>
      </HandNote>
      <p className="mt-4 text-sm font-semibold">{LANDING_UPDATE.title}</p>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {LANDING_UPDATE.summary}
      </p>
      <ul className="mt-3 space-y-2">
        {LANDING_UPDATE.changes.map((change) => (
          <li key={change.title} className="relative pl-5 text-sm leading-snug">
            <span
              aria-hidden="true"
              className="lp-ink-check text-primary absolute top-0 left-0"
            >
              ✓
            </span>
            <span className="text-muted-foreground">{change.summary}</span>
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary
          className={cn(
            "text-primary w-fit cursor-pointer rounded-sm py-2 text-sm font-semibold hover:underline",
            FOCUS_RING,
          )}
        >
          Czytaj całą aktualizację
        </summary>
        <div className="mt-2 space-y-3">
          {LANDING_UPDATE.changes.map((change) => (
            <div key={change.title}>
              <h4 className="text-sm font-semibold">{change.title}</h4>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {change.text}
              </p>
            </div>
          ))}
        </div>
      </details>
      <a
        href={`${REPOSITORY_URL}/commits`}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "text-muted-foreground hover:text-primary mt-1 inline-flex min-h-11 items-center rounded-sm text-xs underline underline-offset-4",
          FOCUS_RING,
        )}
      >
        Wcześniejsze zmiany na GitHubie ↗
      </a>
      <HandNote className="mt-3 text-[1.4rem]!">{LANDING_UPDATE.note}</HandNote>
      <HandNote
        aria-hidden="true"
        className="mt-5 text-right text-[1.3rem]! opacity-35"
      >
        ∫ sin x dx = −cos x + C
      </HandNote>
      <MarginSketch />
    </article>
  );
}
