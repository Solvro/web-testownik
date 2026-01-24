import type { Metadata } from "next";

import { CreateQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Stwórz quiz",
};

export default function CreateQuizPage() {
  return <CreateQuizPageClient />;
}
