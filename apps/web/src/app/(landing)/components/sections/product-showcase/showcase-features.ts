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
      "Jedna lub kilka poprawnych odpowiedzi, natychmiastowy wynik i wyjaśnienie po każdym pytaniu. Zamiast kolejny raz czytać notatki, od razu widzisz, do czego warto wrócić.",
    cta: "Rozwiąż pierwszy quiz",
  },
  {
    id: "ai",
    label: "AI",
    title: "Asystent, który zna Twój quiz.",
    description:
      "Nie zaczynasz rozmowy od tłumaczenia kontekstu. Asystent widzi aktywne pytanie, odpowiedzi i cały zestaw. Wyjaśnia, podpowiada i tworzy lepsze pytania dokładnie tam, gdzie się uczysz.",
    cta: "Zapytaj we własnym quizie",
  },
  {
    id: "grades",
    label: "Średnia ocena",
    title: "Średnia prosto z USOSa.",
    description:
      "Oceny i punkty ECTS same wpadają z USOSa, bez przepisywania. Symulator pokazuje na żywo, jak kolejna ocena przesunie Twoją średnią, więc od razu wiesz, ile możesz zyskać albo stracić.",
    cta: "Policz swoją średnią",
  },
  {
    id: "stats",
    label: "Statystyki",
    title: "Wiesz, co naprawdę umiesz.",
    description:
      "Sesje, odpowiedzi, czas nauki i pytania, na których najczęściej się mylisz. Widzisz je dla siebie i dla całej grupy, która korzysta z tego samego quizu.",
    cta: "Zobacz statystyki quizu",
  },
];
