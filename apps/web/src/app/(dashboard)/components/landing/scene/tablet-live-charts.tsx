"use client";

import { useEffect, useRef } from "react";

import { HourlyChart } from "@/components/quiz/stats/hourly-chart";
import { ScoreChart } from "@/components/quiz/stats/score-chart";
import { SessionsChart } from "@/components/quiz/stats/sessions-chart";
import { StudyTimeChart } from "@/components/quiz/stats/study-time-chart";
import { PREVIEW_QUIZ_ID } from "@/components/testownik-preview/preview-fixtures";
import { PreviewDataProvider } from "@/components/testownik-preview/preview-provider";
import { cn } from "@/lib/utils";

export function TabletLiveCharts({
  visible,
  onReady,
}: {
  visible: boolean;
  onReady: () => void;
}): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let previousSignature: string | null = null;
    let stableFrames = 0;

    const check = (): void => {
      const charts = root.current?.querySelectorAll<SVGSVGElement>(
        "svg.recharts-surface",
      );
      let signature: string | null = null;

      if (charts?.length === 4) {
        const parts = Array.from(charts, (chart) => {
          const container = chart.closest<HTMLElement>(
            ".recharts-responsive-container",
          );
          if (container === null) {
            return null;
          }

          const { width, height } = chart.viewBox.baseVal;
          if (
            container.clientWidth <= 0 ||
            container.clientHeight <= 0 ||
            Math.abs(width - container.clientWidth) > 1 ||
            Math.abs(height - container.clientHeight) > 1 ||
            chart.querySelector(
              ".recharts-layer path, .recharts-layer rect, .recharts-layer polygon",
            ) === null
          ) {
            return null;
          }

          return chart.innerHTML;
        });
        if (parts.every((part) => part !== null)) {
          signature = parts.join("|");
        }
      }

      stableFrames =
        signature !== null && signature === previousSignature
          ? stableFrames + 1
          : 0;
      previousSignature = signature;
      if (stableFrames >= 2) {
        onReady();
      } else {
        frame = requestAnimationFrame(check);
      }
    };

    frame = requestAnimationFrame(check);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [onReady]);

  return (
    <PreviewDataProvider>
      <div
        ref={root}
        aria-hidden={!visible}
        className={cn(
          "bg-background text-foreground absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 overflow-hidden p-2 text-[0.68em] transition-opacity duration-150",
          "[&_[data-slot=card]]:h-full [&_[data-slot=card]]:min-h-0 [&_[data-slot=card]]:gap-1.5 [&_[data-slot=card]]:overflow-hidden [&_[data-slot=card]]:py-2.5",
          "[&_[data-slot=card-action]]:hidden [&_[data-slot=card-description]]:hidden",
          "[&_[data-slot=card-content]]:flex [&_[data-slot=card-content]]:min-h-0 [&_[data-slot=card-content]]:flex-1 [&_[data-slot=card-content]]:px-2.5 [&_[data-slot=card-header]]:px-2.5",
          "[&_[data-slot=card-content]>div]:size-full [&_[data-slot=card-content]>div>div]:size-full",
          "[&_[data-slot=chart]]:aspect-auto! [&_[data-slot=chart]]:h-full! [&_[data-slot=chart]]:min-h-0! [&_[data-slot=chart]]:w-full!",
          visible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <SessionsChart
          quizId={PREVIEW_QUIZ_ID}
          canViewAll={false}
          animated={false}
        />
        <ScoreChart
          quizId={PREVIEW_QUIZ_ID}
          canViewAll={false}
          animated={false}
        />
        <StudyTimeChart
          quizId={PREVIEW_QUIZ_ID}
          canViewAll={false}
          animated={false}
        />
        <HourlyChart
          quizId={PREVIEW_QUIZ_ID}
          canViewAll={false}
          animated={false}
        />
      </div>
    </PreviewDataProvider>
  );
}
