import type { Metadata } from "next";

import { CurrentLegalDocument } from "@/components/legal/legal-document-page";

export const metadata: Metadata = {
  title: "Polityka Prywatności",
};

export default function PrivacyPolicyPage() {
  return <CurrentLegalDocument kind="privacy" />;
}
