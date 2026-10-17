export interface ShowcaseFeature {
  id: "quiz" | "ai" | "grades" | "stats";
  label: string;
  title: string;
  description: string;
  cta: string;
}

export type ShowcaseFeatureId = ShowcaseFeature["id"];

export const SHOWCASE_FEATURES: readonly ShowcaseFeature[] = [
  {
    id: "quiz",
    label: "Quizy",
    title: "Sprawdź, co naprawdę pamiętasz.",
    description:
      "Jedna lub kilka poprawnych odpowiedzi, natychmiastowy wynik i wyjaśnienie po każdym pytaniu. Zamiast kolejny raz czytać notatki, od razu widzisz, do czego warto wrócić.",
    cta: "Rozwiąż pierwszy quiz",
  },
  {
    id: "ai",
    label: "AI",
    title: "Asystent, który zna Twój quiz.",
    description:
      "Nie zaczynasz rozmowy od tłumaczenia kontekstu. Asystent widzi aktywne pytanie, odpowiedzi i cały zestaw — wyjaśnia, podpowiada i tworzy lepsze pytania dokładnie tam, gdzie się uczysz.",
    cta: "Zapytaj we własnym quizie",
  },
  {
    id: "grades",
    label: "Średnia ocena",
    title: "Każda ocena od razu pokazuje, co zmienia.",
    description:
      "Oceny i ECTS układają się w czytelny obraz semestru. Kliknij dowolny wynik w symulatorze i zobacz na żywo, jak zmieni się Twoja średnia — bez arkusza i ręcznego liczenia.",
    cta: "Policz swoją średnią",
  },
  {
    id: "stats",
    label: "Statystyki",
    title: "Wiesz, co naprawdę umiesz.",
    description:
      "Sesje, odpowiedzi, czas nauki i pytania, na których najczęściej się mylisz — dla Ciebie i dla całej grupy, która korzysta z tego samego quizu.",
    cta: "Zobacz statystyki quizu",
  },
];
