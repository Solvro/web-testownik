import { ChevronDownIcon } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { GradeDistributionChart } from "./grade-distribution-chart";
import type { CourseView } from "./grade-utils";
import { fmtNumber, fmtSigned } from "./grade-utils";

type GradeBadgeProps = Omit<ComponentPropsWithoutRef<"span">, "color"> & {
  symbol: string;
  color: string;
  soft: string;
  showTitle?: boolean;
};

const GradeBadge = forwardRef<HTMLSpanElement, GradeBadgeProps>(
  (
    { symbol, color, soft, className, showTitle = true, style, ...props },
    ref,
  ) => (
    <span
      ref={ref}
      title={showTitle ? symbol : undefined}
      className={className}
      style={{ background: soft, color, ...style }}
      {...props}
    >
      {symbol}
    </span>
  ),
);
GradeBadge.displayName = "GradeBadge";

function PartialGradeBadge({ sub }: { sub: CourseView["subs"][number] }) {
  const hasGroupContext = sub.groupAverage != null || sub.groupDelta != null;
  const badge = (
    <GradeBadge
      symbol={sub.symbol}
      color={sub.color.fg}
      soft={sub.color.soft}
      showTitle={!hasGroupContext}
      className="min-w-11 rounded-lg px-2.5 py-1 text-center text-sm font-bold tabular-nums"
    />
  );

  if (!hasGroupContext) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={badge}></TooltipTrigger>
      <TooltipContent className="grid min-w-44 gap-1.5 px-3 py-2">
        <div className="flex items-center justify-between gap-4">
          <span className="opacity-75">Średnia grupy</span>
          <span className="font-bold tabular-nums">
            {fmtNumber(sub.groupAverage)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="opacity-75">Na tle grupy</span>
          <span
            className="font-bold tabular-nums"
            style={sub.groupDelta == null ? undefined : { color: sub.color.fg }}
          >
            {sub.groupDelta == null ? "-" : fmtSigned(sub.groupDelta)}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function CourseRow({
  course,
  expanded,
  onOpenChange,
}: {
  course: CourseView;
  expanded: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hero = course.hero;
  const hasMainGrade = hero?.value != null;
  const hasMainDetails =
    hero != null && (hero.value != null || hero.distribution.length > 0);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={onOpenChange}
      className="mb-0.5 rounded-xl transition-colors"
      style={{
        background: expanded
          ? "color-mix(in oklab, var(--primary) 6%, transparent)"
          : "transparent",
      }}
    >
      <CollapsibleTrigger className="hover:bg-primary/5 flex w-full cursor-pointer items-center gap-1 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none sm:gap-3 sm:px-3 sm:py-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug font-semibold break-words">
            {course.name}
          </div>
          <div className="text-muted-foreground mt-0.5 truncate text-xs tabular-nums">
            {course.code}
          </div>
        </div>
        <div className="text-muted-foreground w-8 shrink-0 text-center text-sm font-semibold tabular-nums sm:w-16">
          {course.ects}
        </div>
        <div className="flex w-16 shrink-0 justify-end sm:w-23">
          <GradeBadge
            symbol={hero?.symbol ?? "-"}
            color={course.color.fg}
            soft={course.color.soft}
            className="block max-w-full min-w-11 truncate rounded-lg px-2.5 py-1 text-center text-sm font-extrabold tabular-nums sm:min-w-12 sm:px-3 sm:py-1.5 sm:text-base"
          />
        </div>
        <ChevronDownIcon
          className="text-muted-foreground hidden size-4 shrink-0 transition-transform sm:block"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-1.5 pr-2 pb-4 pl-3 sm:pr-3.5 sm:pl-6">
        {hasMainDetails ? (
          <div className="grid grid-cols-1 items-end gap-5 py-3.5 md:grid-cols-[1.35fr_1fr]">
            <div>
              <div className="text-muted-foreground mb-2 flex justify-between text-xs">
                <span>Rozkład w grupie - {hero.reportType}</span>
                <span className="text-foreground font-semibold">
                  Twoja: {hero.symbol}
                </span>
              </div>
              <GradeDistributionChart
                distribution={hero.distribution}
                yourValue={hero.value}
              />
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Średnia grupy</span>
                <span className="font-bold tabular-nums">
                  {fmtNumber(hero.groupAverage)}
                </span>
              </div>
              {hero.groupDelta != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Na tle grupy</span>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: hero.color.fg }}
                  >
                    {fmtSigned(hero.groupDelta)}
                  </span>
                </div>
              )}
              {hero.issuer != null && (
                <div className="flex justify-between gap-3.5 text-xs">
                  <span className="text-muted-foreground whitespace-nowrap">
                    Wystawił(a)
                  </span>
                  <span className="text-right font-medium">{hero.issuer}</span>
                </div>
              )}
              {hero.counts ? (
                <div className="bg-primary/15 text-primary inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold">
                  ● Liczy się do średniej
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {course.subs.length > 0 ? (
          <div
            className={cn(
              hasMainDetails &&
                "border-border mt-3 border-t border-dashed pt-3",
            )}
          >
            <div className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
              Oceny cząstkowe
            </div>
            {course.subs.map((sub) => (
              <div key={sub.key} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {sub.typeLabel}
                  </div>
                  <div className="text-muted-foreground mt-px truncate text-xs">
                    {[sub.issuer, sub.counts ? "Liczy się" : "Nie liczy się"]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="hidden w-30 sm:block">
                  <GradeDistributionChart
                    distribution={sub.distribution}
                    yourValue={sub.value}
                    mini
                  />
                </div>
                <PartialGradeBadge sub={sub} />
              </div>
            ))}
          </div>
        ) : hasMainGrade ? null : (
          <div
            className={cn(
              "text-muted-foreground text-xs",
              hasMainDetails
                ? "border-border mt-2.5 border-t border-dashed pt-3"
                : "py-2",
            )}
          >
            Brak ocen w tym przedmiocie.
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
