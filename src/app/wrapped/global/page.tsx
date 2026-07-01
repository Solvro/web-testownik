import type { Metadata } from "next";

import { WrappedExperience } from "../components/wrapped-experience";

export const metadata: Metadata = {
  title: "Wrapped — cały Testownik",
  description: "Podsumowanie semestru całego Testownika w liczbach.",
  openGraph: {
    title: "Testownik Wrapped — cały Testownik",
    description: "Podsumowanie semestru całego Testownika w liczbach.",
    type: "website",
    locale: "pl_PL",
  },
};

export default function GlobalWrappedPage() {
  return <WrappedExperience mode="global" />;
}
