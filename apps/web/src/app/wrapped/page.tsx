import type { Metadata } from "next";

import { WrappedPageClient } from "./client";

export const metadata: Metadata = {
  title: "Wrapped",
  description: "Twój semestr w Testowniku - podsumowanie w liczbach.",
  openGraph: {
    title: "Testownik Wrapped",
    description: "Twój semestr w Testowniku - podsumowanie w liczbach.",
    type: "website",
    locale: "pl_PL",
  },
};

export default function WrappedPage() {
  return <WrappedPageClient />;
}
