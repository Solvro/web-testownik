import React from "react";
import QuestionQuizCard from "../components/dashboard/QuestionQuizCard.tsx";
import LastUsedCard from "../components/dashboard/LastUsedCard.tsx";
import AboutCard from "../components/dashboard/AboutCard.tsx";
import SearchCard from "../components/dashboard/SearchCard.tsx";
import ImportButtonsCard from "../components/dashboard/ImportButtonsCard.tsx";

const DashboardPage: React.FC = () => {
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
};

export default DashboardPage;
