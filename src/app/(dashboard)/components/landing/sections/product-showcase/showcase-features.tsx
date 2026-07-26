import { Check, Sparkles, Users } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The four scenes the showcase can put in the window. `badge` is the small
 * marker shown next to "interaktywny podgląd" for that scene.
 */
export interface ShowcaseFeature {
  id: "quiz" | "grades" | "sharing" | "ai";
  label: string;
  kicker: string;
  title: string;
  description: string;
  badge: ReactNode;
}

export type ShowcaseFeatureId = ShowcaseFeature["id"];

export const SHOWCASE_FEATURES: readonly ShowcaseFeature[] = [
  {
    id: "quiz",
    label: "Aktywny quiz",
    kicker: "Powtórki",
    title: "Prawdziwa sesja, nie makieta fiszek.",
    description:
      "Ten podgląd odwzorowuje kartę pytania, wybór odpowiedzi i wynik działające dziś w Testowniku.",
    badge: <Check aria-hidden="true" />,
  },
  {
    id: "grades",
    label: "Oceny",
    kicker: "USOS + symulator",
    title: "Sprawdź średnią. Potem sprawdź, co będzie jeśli.",
    description:
      "Oceny, ECTS i semestry spotykają się z interaktywną prognozą — bez arkusza liczonego noc przed stypendium.",
    badge: (
      <strong aria-hidden="true" className="text-primary text-base">
        4,63
      </strong>
    ),
  },
  {
    id: "sharing",
    label: "Udostępnianie",
    kicker: "Wspólna nauka",
    title: "Ten sam quiz może należeć do całej grupy.",
    description:
      "Dostęp do odczytu lub edycji, kopiowanie linku i lista osób odpowiadają prawdziwemu dialogowi udostępniania.",
    badge: <Users aria-hidden="true" />,
  },
  {
    id: "ai",
    label: "Asystent AI",
    kicker: "Kontekst pytania",
    title: "Wyjaśnienie zna pytanie, odpowiedzi i materiał.",
    description:
      "Poproś o wskazówkę, prostsze wyjaśnienie albo podobne pytanie. Asystent pozostaje w kontekście aktywnego quizu.",
    badge: <Sparkles aria-hidden="true" />,
  },
];
