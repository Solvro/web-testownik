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

const CARD_PLACEMENT = [
  "top-0 right-0 max-lg:inset-x-0 max-lg:mx-auto [--card-tilt:5deg] [--card-depth:0px]",
  "max-lg:hidden top-[5.5rem] left-0 [--card-tilt:-6deg] [--card-depth:12px]",
  "bottom-0 max-lg:inset-x-0 max-lg:mx-auto lg:left-[14%] [--card-tilt:-1.5deg] [--card-depth:24px]",
] as const;

const CARD_BACKGROUNDS = ["pizza", "laptop", "fashion"] as const;

function OfferBadge({
  badge,
}: {
  badge: PerksOffer["badge"];
}): React.JSX.Element {
  const label =
    badge.kind === "new"
      ? "🎉 Nowość"
      : `🔥 ${numberFormat.format(badge.value)} ${ACTIVATIONS[activationWords.select(badge.value)]}`;
  return (
    <span className="rounded-full bg-black/40 px-2.5 py-1 text-[13px] leading-none font-semibold whitespace-nowrap text-white">
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
        "lp-perk-card absolute h-[13.5rem] w-[300px] lg:h-[15.5rem] lg:w-[22rem]",
        front && "lg:h-[17rem] lg:w-[24rem]",
        CARD_PLACEMENT[index],
      )}
    >
      <div
        className={cn(
          "group/card relative isolate flex size-full flex-col justify-between overflow-hidden rounded-[24px] p-5 shadow-[0_24px_50px_-30px_rgb(35_5_71/0.35)] lg:p-6",
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
          className="-z-20 scale-[1.04] object-cover blur-[3px]"
        />
        <div
          className={cn(
            "absolute inset-0 -z-10",
            front ? "bg-[#32105c]/20" : "bg-[#14202d]/10",
          )}
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/40 via-40% to-black/0" />
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white/15">
            <Icon className="size-5 text-white" />
          </div>
          <OfferBadge badge={offer.badge} />
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
