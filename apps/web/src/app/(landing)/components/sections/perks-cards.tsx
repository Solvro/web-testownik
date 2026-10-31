import {
  Dumbbell,
  Flower2,
  Laptop,
  Shirt,
  Tag,
  Ticket,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";

import type { PerksOffer } from "../../lib/perks";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Jedzenie: UtensilsCrossed,
  Technologia: Laptop,
  Moda: Shirt,
  Uroda: Flower2,
  Lifestyle: Ticket,
  "Zdrowie & Fitness": Dumbbell,
};

const numberFormat = new Intl.NumberFormat("pl-PL");
const activationWords = new Intl.PluralRules("pl-PL");
const ACTIVATIONS: Record<Intl.LDMLPluralRule, string> = {
  zero: "aktywacji",
  one: "aktywacja",
  two: "aktywacje",
  few: "aktywacje",
  many: "aktywacji",
  other: "aktywacji",
};

/** `2027-03-31` → `31.03.2027`, uniperks' own date format. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

/*
 * Back to front: +5°, −6°, −1.5°. Hovering the stack fans it out, front card
 * first, with a slight spring; the card under the pointer then straightens
 * (an inner counter-rotation), rises above the others and casts a deeper
 * shadow. Nothing moves with reduced motion. Below `lg` only the back and
 * front cards show, both 300 px wide.
 */
const CARD_PLACEMENT = [
  "top-0 right-0 max-lg:inset-x-0 max-lg:mx-auto [--card-tilt:5deg] [--card-fan:8deg] motion-safe:delay-[90ms] motion-safe:group-hover/perks:translate-x-3 motion-safe:group-hover/perks:-translate-y-2",
  "max-lg:hidden top-[5.5rem] left-0 [--card-tilt:-6deg] [--card-fan:-9deg] motion-safe:delay-[45ms] motion-safe:group-hover/perks:-translate-x-4",
  "bottom-0 max-lg:inset-x-0 max-lg:mx-auto lg:left-[14%] [--card-tilt:-1.5deg] [--card-fan:-2.5deg] motion-safe:group-hover/perks:-translate-y-1",
] as const;

/** Spring-ish ease: a few percent of overshoot, then settle. */
const CARD_MOTION =
  "motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.34,1.4,0.64,1)]";

function OfferBadge({
  badge,
  front,
}: {
  badge: NonNullable<PerksOffer["badge"]>;
  front: boolean;
}): React.JSX.Element | null {
  if (badge.kind === "activations" && badge.value === undefined) {
    return null;
  }
  const label =
    badge.kind === "limited"
      ? "Limitowany"
      : badge.kind === "new"
        ? "🎉 Nowość"
        : `🔥 ${numberFormat.format(badge.value ?? 0)} ${ACTIVATIONS[activationWords.select(badge.value ?? 0)]}`;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[13px] leading-none font-semibold whitespace-nowrap",
        badge.kind === "limited"
          ? "bg-[#FEEBE7] text-[#A33B22]"
          : front
            ? "bg-white/15 text-white"
            : "bg-(--perk-bg) text-(--perk-fg)",
      )}
    >
      {label}
    </span>
  );
}

function OfferCard({
  offer,
  index,
}: {
  offer: PerksOffer;
  index: number;
}): React.JSX.Element {
  const front = index === CARD_PLACEMENT.length - 1;
  const Icon = CATEGORY_ICONS[offer.category] ?? Tag;
  const meta = [
    offer.validUntil === undefined
      ? offer.limited === true
        ? "Limitowany"
        : null
      : `Ważny do ${formatDate(offer.validUntil)}`,
    offer.channel,
  ].filter((part) => part !== null);

  return (
    <div
      className={cn(
        "absolute h-[13.5rem] w-[300px] rotate-(--card-tilt) hover:z-10 motion-safe:group-hover/perks:rotate-(--card-fan) lg:h-[15.5rem] lg:w-[22rem]",
        "motion-safe:transition-[rotate,translate]",
        CARD_MOTION,
        front && "lg:h-[17rem] lg:w-[24rem]",
        CARD_PLACEMENT[index],
      )}
    >
      <div
        className={cn(
          "group/card flex size-full flex-col justify-between rounded-[24px] p-5 shadow-[0_24px_50px_-30px_rgb(35_5_71/0.35)] lg:p-6",
          "motion-safe:transition-[rotate,translate,scale,box-shadow] motion-safe:hover:-translate-y-2 motion-safe:hover:scale-[1.02] motion-safe:hover:rotate-[calc(var(--card-fan)*-1)] motion-safe:hover:shadow-[0_36px_60px_-28px_rgb(35_5_71/0.5)]",
          CARD_MOTION,
          front
            ? "bg-(--perk-accent) text-(--perk-accent-fg)"
            : "bg-(--perk-card) text-(--perk-fg)",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center overflow-hidden rounded-[10px]",
              front ? "bg-white/15" : "bg-(--perk-bg)",
            )}
          >
            {offer.logoUrl === undefined ? (
              <Icon
                className={cn(
                  "size-5 motion-safe:transition-[rotate,scale] motion-safe:group-hover/card:scale-110 motion-safe:group-hover/card:-rotate-12",
                  CARD_MOTION,
                  front
                    ? "text-(--perk-accent-fg)"
                    : "text-(--perk-accent-ink)",
                )}
              />
            ) : (
              <Image
                src={offer.logoUrl}
                alt=""
                width={44}
                height={44}
                className="size-full object-cover"
              />
            )}
          </div>
          {offer.badge === undefined ? null : (
            <OfferBadge badge={offer.badge} front={front} />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[13px]",
              front ? "text-(--perk-accent-fg)/75" : "text-(--perk-muted)",
            )}
          >
            {offer.category}
          </p>
          <p
            className={cn(
              "mt-1 line-clamp-2 font-bold tracking-[-0.02em] text-balance",
              front
                ? "text-[19px] leading-[1.15] lg:text-[30px] lg:leading-[1.02] lg:tracking-[-0.035em]"
                : "text-[19px] leading-[1.15]",
            )}
          >
            {offer.title}
          </p>
          <p
            className={cn(
              "mt-2 truncate text-[13px]",
              front ? "text-(--perk-accent-fg)/75" : "text-(--perk-muted)",
            )}
          >
            {meta.join(" · ")}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Decorative offer cards in uniperks' card anatomy. */
export function PerksCards({
  offers,
}: {
  offers: readonly PerksOffer[];
}): React.JSX.Element {
  return (
    <>
      {offers.slice(0, CARD_PLACEMENT.length).map((offer, index) => (
        <OfferCard key={offer.id} offer={offer} index={index} />
      ))}
    </>
  );
}

/** Same footprint as the resolved stack, so streamed cards cause no shift. */
export function PerksCardsSkeleton(): React.JSX.Element {
  return (
    <>
      {CARD_PLACEMENT.map((placement, index) => (
        <div
          key={placement}
          className={cn(
            "absolute h-[13.5rem] w-[300px] rotate-(--card-tilt) rounded-[24px] bg-(--perk-card) lg:h-[15.5rem] lg:w-[22rem]",
            index === CARD_PLACEMENT.length - 1 &&
              "bg-(--perk-accent)/40 lg:h-[17rem] lg:w-[24rem]",
            placement,
          )}
        />
      ))}
    </>
  );
}
