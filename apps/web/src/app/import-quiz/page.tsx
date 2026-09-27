import type { Metadata } from "next";

import { ImportQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Importuj quiz",
};

export default function ImportQuizPage() {
  return <ImportQuizPageClient />;
}
