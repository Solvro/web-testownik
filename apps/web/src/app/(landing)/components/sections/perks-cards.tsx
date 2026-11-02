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
  "top-0 right-0 [--card-tilt:5deg] [--card-x:calc(50cqw-11rem)] [--card-y:-7.25rem]",
  "top-[5.5rem] left-0 [--card-tilt:-6deg] [--card-x:calc(11rem-50cqw)] [--card-y:-1.75rem]",
  "bottom-0 left-[14%] [--card-tilt:-1.5deg] [--card-x:calc(12rem-36cqw)] [--card-y:6.5rem]",
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
    <span className="rounded-full bg-black/45 px-2.5 py-1 text-[13px] leading-none font-semibold whitespace-nowrap text-white">
      {label}
    </span>
  );
}

function CardFace({
  offer,
  background,
  accent,
  large = false,
}: {
  offer: PerksOffer;
  background: (typeof CARD_BACKGROUNDS)[number];
  accent: boolean;
  large?: boolean;
}): React.JSX.Element {
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
        "lp-perk-face relative isolate flex size-full flex-col justify-between overflow-hidden rounded-[24px] p-5 shadow-[0_24px_50px_-30px_rgb(35_5_71/0.35)] lg:p-6",
        accent
          ? "bg-(--perk-accent) text-(--perk-accent-fg)"
          : "bg-[#263647] text-white",
      )}
    >
      {/* A sharp photo under a scrim; blur behind the copy only smudged it. */}
      <Image
        src={`/images/perks/${background}.webp`}
        alt=""
        fill
        sizes="(min-width: 1024px) 384px, 100vw"
        className="-z-20 object-cover object-top"
      />
      <div
        className={cn(
          "absolute inset-0 -z-10",
          accent
            ? "bg-linear-to-t from-[#230547] via-[#230547]/60 via-45% to-[#230547]/0"
            : "bg-linear-to-t from-black/90 via-black/55 via-45% to-black/0",
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-black/35">
          <Icon className="size-5 text-white" />
        </div>
        <OfferBadge badge={offer.badge} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-white/85">{offer.category}</p>
        <p
          className={cn(
            "mt-1 line-clamp-2 font-bold tracking-[-0.02em] text-balance",
            large
              ? "text-[30px] leading-[1.02] tracking-[-0.035em]"
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
  );
}

/** The stack beside the copy at `lg`. */
export function PerksCards({
  offers,
}: {
  offers: readonly PerksOffer[];
}): React.JSX.Element {
  return (
    <>
      {offers.slice(0, CARD_PLACEMENT.length).map((offer, index) => {
        const front = index === CARD_PLACEMENT.length - 1;
        return (
          <div
            key={offer.id}
            className={cn(
              "lp-perk-card absolute h-[15.5rem] w-[22rem]",
              front && "h-[17rem] w-[24rem]",
              CARD_PLACEMENT[index],
            )}
          >
            <div className="lp-perk-reveal size-full">
              <div className="lp-perk-motion size-full">
                <CardFace
                  offer={offer}
                  background={CARD_BACKGROUNDS[index]}
                  accent={front}
                  large={front}
                />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

/*
 * The two cards behind the middle one below `lg`: pushed out to each side,
 * turned away and dimmed, so they read as a deck seen from the front.
 * Each carries its own `perspective()`, so plain z-index does the stacking.
 */
const COVERFLOW_SIDES = [
  "[--coverflow-rest:perspective(900px)_translateX(-62%)_rotateY(32deg)_scale(0.88)]",
  "[--coverflow-rest:perspective(900px)_translateX(62%)_rotateY(-32deg)_scale(0.88)]",
] as const;

/** Below `lg`: three offers as a still coverflow, the first in front. */
export function PerksCoverflow({
  offers,
}: {
  offers: readonly PerksOffer[];
}): React.JSX.Element {
  const [middle, ...sides] = offers.slice(0, 3);
  return (
    <div className="-mx-4 overflow-hidden py-6 sm:-mx-6">
      <div className="relative mx-auto h-[12.5rem] w-[74%] max-w-[22rem]">
        {sides.map((offer, index) => (
          <div
            key={offer.id}
            className={cn(
              "lp-perk-cover-card absolute inset-0",
              COVERFLOW_SIDES[index],
            )}
          >
            <CardFace
              offer={offer}
              background={CARD_BACKGROUNDS[index + 1]}
              accent={false}
            />
            <div className="absolute inset-0 rounded-[24px] bg-black/35" />
          </div>
        ))}
        <div className="lp-perk-cover-card absolute inset-0 z-10">
          <CardFace
            offer={middle}
            background={CARD_BACKGROUNDS[0]}
            accent={false}
          />
        </div>
      </div>
    </div>
  );
}
