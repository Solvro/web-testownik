import React from "react";

import AboutCard from "../components/dashboard/about-card.tsx";
import ImportButtonsCard from "../components/dashboard/import-buttons-card.tsx";
import LastUsedCard from "../components/dashboard/last-used-card.tsx";
import QuestionQuizCard from "../components/dashboard/question-quiz-card.tsx";
import SearchCard from "../components/dashboard/search-card.tsx";

function DashboardPage(): React.JSX.Element {
  document.title = "Testownik Solvro";

  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:grid-rows-3 md:h-[70vh] md:grid-cols-3 md:grid-rows-2">
      <LastUsedCard className="md:order-2" />
      <ImportButtonsCard className="md:order-4" />
      <QuestionQuizCard className="row-span-2 md:order-1" />
      <SearchCard className="md:order-3" />
      <AboutCard className="md:order-5" />
    </div>
  );
}

export { DashboardPage as default };
