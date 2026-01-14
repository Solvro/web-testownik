"use client";

import { AuthGuard } from "@/components/auth-guard";
import { AboutCard } from "@/components/dashboard/about-card";
import { ImportButtonsCard } from "@/components/dashboard/import-buttons-card";
import { LastUsedCard } from "@/components/dashboard/last-used-card";
import { QuestionQuizCard } from "@/components/dashboard/question-quiz-card";
import { SearchCard } from "@/components/dashboard/search-card";

export function DashboardPageClient(): React.JSX.Element {
  return (
    <AuthGuard>
      <div className="grid gap-4 sm:grid-cols-2 sm:grid-rows-3 md:h-[70vh] md:grid-cols-3 md:grid-rows-2">
        <LastUsedCard className="md:order-2" />
        <ImportButtonsCard className="md:order-4" />
        <QuestionQuizCard className="row-span-2 md:order-1" />
        <SearchCard className="md:order-3" />
        <AboutCard className="md:order-5" />
      </div>
    </AuthGuard>
  );
}
