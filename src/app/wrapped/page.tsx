import type { Metadata } from "next";

import { WrappedPageClient } from "./client";

export const metadata: Metadata = {
  title: "Wrapped",
  description: "Twój semestr w Testowniku — podsumowanie w liczbach.",
};

export default function WrappedPage() {
  return <WrappedPageClient />;
}
