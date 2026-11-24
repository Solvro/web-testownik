import type { Metadata } from "next";

import { CurrentLegalDocument } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Regulamin",
};

export default function TermsPage() {
  return <CurrentLegalDocument kind="terms" />;
}
