/* eslint-disable react-refresh/only-export-components */
import type { Metadata } from "next";

import { PrivacyPolicyPageClient } from "./client";

export const metadata: Metadata = {
  title: "Polityka Prywatności",
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyPageClient />;
}
