import { LANDING_UPDATE } from "../landing-content";
import { HandNote, MarginSketch } from "../ui/hand-note";

export function UpdateNote(): React.JSX.Element {
  return (
    <article
      aria-labelledby="landing-update-heading"
      className="lp-update-note relative mt-10 max-w-sm"
    >
      <time
        dateTime={LANDING_UPDATE.date}
        className="text-muted-foreground text-[0.65rem] font-semibold tracking-[0.12em] uppercase"
      >
        {LANDING_UPDATE.label}
      </time>
      <h3
        id="landing-update-heading"
        className="text-primary mt-2 text-xl font-semibold"
      >
        {LANDING_UPDATE.heading}
      </h3>
      <ul className="mt-5 space-y-5">
        {LANDING_UPDATE.changes.map((change) => (
          <li key={change.title} className="relative pl-7">
            <span
              aria-hidden="true"
              className="lp-ink-check text-primary absolute top-0 left-0"
            >
              ✓
            </span>
            <h4 className="text-sm font-semibold">{change.title}</h4>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {change.text}
            </p>
          </li>
        ))}
      </ul>
      <HandNote className="mt-6">{LANDING_UPDATE.note}</HandNote>
      <HandNote aria-hidden="true" className="mt-8 text-right opacity-35">
        ∫ sin x dx = −cos x + C
      </HandNote>
      <MarginSketch />
    </article>
  );
}
