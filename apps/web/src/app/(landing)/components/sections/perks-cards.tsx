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

// Fixed layers preserve spatial continuity as the entire stack gently opens.
const CARD_PLACEMENT = [
  "top-0 right-0 z-0 max-lg:inset-x-0 max-lg:mx-auto [--card-tilt:5deg] lg:motion-safe:group-hover/perks:translate-x-5 lg:motion-safe:group-hover/perks:-translate-y-3",
  "max-lg:hidden top-[5.5rem] left-0 z-1 [--card-tilt:-6deg] lg:motion-safe:group-hover/perks:-translate-x-6",
  "bottom-0 z-2 max-lg:inset-x-0 max-lg:mx-auto lg:left-[14%] [--card-tilt:-1.5deg] lg:motion-safe:group-hover/perks:translate-y-3",
] as const;

const CARD_BACKGROUNDS = ["pizza", "laptop", "fashion"] as const;
const CARD_MOTION =
  "motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]";

function OfferBadge({
  badge,
}: {
  badge: NonNullable<PerksOffer["badge"]>;
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
          : "bg-white/15 text-white",
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
        "absolute h-[13.5rem] w-[300px] rotate-(--card-tilt) lg:h-[15.5rem] lg:w-[22rem]",
        "motion-safe:transition-transform",
        CARD_MOTION,
        front && "lg:h-[17rem] lg:w-[24rem]",
        CARD_PLACEMENT[index],
      )}
    >
      <div
        className={cn(
          "group/card relative isolate flex size-full flex-col justify-between overflow-hidden rounded-[24px] p-5 shadow-[0_24px_50px_-30px_rgb(35_5_71/0.35)] lg:p-6",
          "motion-safe:transition-transform lg:motion-safe:hover:-translate-y-1 lg:motion-safe:hover:scale-[1.015]",
          CARD_MOTION,
          front
            ? "bg-(--perk-accent) text-(--perk-accent-fg)"
            : "bg-[#263647] text-white",
        )}
      >
        <Image
          src={`/images/perks/${CARD_BACKGROUNDS[index]}.webp`}
          alt=""
          fill
          sizes="(min-width: 1024px) 384px, 300px"
          className="-z-20 scale-110 object-cover blur-[12px]"
        />
        <div
          className={cn(
            "absolute inset-0 -z-10",
            front ? "bg-[#32105c]/75" : "bg-[#14202d]/75",
          )}
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/15 to-black/0" />
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white/15">
            <Icon className="size-5 text-white" />
          </div>
          {offer.badge === undefined ? null : (
            <OfferBadge badge={offer.badge} />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-white/85">{offer.category}</p>
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
          <p className="mt-2 truncate text-[13px] text-white/85">
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
