import type { Metadata } from "next";

import { TermsPageClient } from "./client";

export const metadata: Metadata = {
  title: "Regulamin",
};

export default function TermsPage() {
  return <TermsPageClient />;
}
