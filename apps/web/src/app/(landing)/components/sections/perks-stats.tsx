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
  return (
    <dl className="grid grid-cols-[1.4fr_1fr_1fr] gap-x-3 border-t border-(--perk-border) pt-6 sm:gap-x-5">
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
            {format.format(value)}
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
