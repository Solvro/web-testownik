import type { Metadata } from "next";

import { QuizzesPageClient } from "./client";

export const metadata: Metadata = {
  title: "Twoje quizy",
};

export default function QuizzesPage() {
  return <QuizzesPageClient />;
}
