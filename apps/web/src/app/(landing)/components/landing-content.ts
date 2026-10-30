import { TEAM_SIZE } from "./team-data";

/**
 * Every piece of landing copy lives here so the section components stay pure
 * layout. Text changes never require touching a component.
 */

export interface TimelineEntry {
  date: string;
  title: string;
  text: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export const REPOSITORY_URL = "https://github.com/Solvro/web-testownik";

export const STORY: readonly TimelineEntry[] = [
  {
    date: "Czerwiec 2024",
    title: "Zaczęło się przed egzaminem z fizyki.",
    text: "Antek, zamiast uczyć się z istniejących aplikacji, zaczął pisać własny Testownik. Pierwsza wersja powstała jako narzędzie, którego sam potrzebował.",
  },
  {
    date: "Druga połowa 2024",
    title: "Pół roku rozwijania solo.",
    text: "Interaktywne quizy, obrazy i powtórki rosły razem z kolejnymi egzaminami. Produkt był używany, zanim stał się projektem zespołowym.",
  },
  {
    date: "Rok akademicki 2024/25",
    title: "Nowa technologia, Łukasz i Franek.",
    text: "Testownik został przepisany podczas kursu KN Kredek. To wtedy samotny projekt zaczął zamieniać się w platformę.",
  },
  {
    date: "Rok akademicki 2025/26",
    title: "Testownik dołącza do KN Solvro.",
    text: "Od tego momentu rozwija go cały zespół: frontend, backend, design, infrastruktura i społeczność.",
  },
  {
    date: "Dzisiaj",
    title: `${TEAM_SIZE.toString()} osób i\u00A0wciąż otwarty kod.`,
    text: "Quizy bez rejestracji, współdzielenie, synchronizacja, statystyki, oceny z USOS i funkcje AI działają jako jeden produkt.",
  },
];

export const FAQ: readonly FaqEntry[] = [
  {
    question: "Czym właściwie jest Testownik?",
    answer:
      "To aplikacja do aktywnej nauki: tworzysz lub importujesz quiz, odpowiadasz na pytania i od razu widzisz, do których tematów warto wrócić. Zamiast kolejny raz czytać notatki, sprawdzasz, co naprawdę pamiętasz.",
  },
  {
    question: "Czy muszę zakładać konto, żeby zacząć?",
    answer:
      "Nie. Możesz wejść jako gość i od razu rozwiązać albo stworzyć quiz. Konto gościa jest tymczasowe, a jego dane są usuwane po 30 dniach bez aktywności. Zalogowanie pozwala zachować postępy na dłużej i korzystać ze wszystkich funkcji.",
  },
  {
    question: "Jak przenieść własne materiały do Testownika?",
    answer:
      "Możesz zbudować zestaw ręcznie albo zaimportować przygotowany quiz. Pytania, odpowiedzi, obrazy i wyjaśnienia układasz tak, żeby zestaw odpowiadał dokładnie Twoim notatkom i sposobowi nauki.",
  },
  {
    question: "Jakie rodzaje pytań mogę tworzyć?",
    answer:
      "Testownik obsługuje pytania z jedną lub kilkoma poprawnymi odpowiedziami. Do pytań i odpowiedzi możesz dodawać obrazy oraz wyjaśnienia, więc równie dobrze sprawdza się przy definicjach, schematach i zadaniach.",
  },
  {
    question: "Czy mogę uczyć się razem ze znajomymi?",
    answer:
      "Tak. Quiz możesz udostępnić innym osobom, a wspólny zestaw pozwala całej grupie pracować na tych samych pytaniach. Statystyki pokazują też, które zagadnienia sprawiają trudność nie tylko Tobie.",
  },
  {
    question: "Co znajdę w statystykach?",
    answer:
      "Zobaczysz sesje, odpowiedzi, czas nauki, wyniki i pytania, przy których najczęściej pojawiają się błędy. To szybka mapa materiału: wiesz, co już umiesz, a co jeszcze warto powtórzyć przed egzaminem.",
  },
  {
    question: "W czym pomaga asystent AI?",
    answer:
      "Asystent zna kontekst aktywnego pytania i całego quizu. Może podpowiedzieć tok rozumowania, wyjaśnić odpowiedź oraz pomóc tworzyć i poprawiać pytania. AI może się mylić, dlatego traktuj je jak pomoc w nauce, nie ostateczne źródło.",
  },
  {
    question: "Czy Testownik pomaga też z ocenami?",
    answer:
      "Tak. Widok ocen łączy wyniki i punkty ECTS w czytelne podsumowanie semestru, a symulator pokazuje, jak kolejna ocena wpłynie na średnią, bez osobnego arkusza i ręcznego liczenia.",
  },
  {
    question: "Czy mogę wyłączyć funkcje AI?",
    answer:
      "Tak. Funkcje AI można wyłączyć w ustawieniach profilu i w każdej chwili włączyć ponownie. Ukrywa to czat, podpowiedzi, wyjaśnienia i pozostałe narzędzia oparte na AI.",
  },
  {
    question: "Gdzie zgłosić błąd albo pomysł?",
    answer:
      "Najprościej przez przycisk „Prześlij opinię” w aplikacji. Projekt jest też otwartoźródłowy, więc problemy i propozycje możesz zgłaszać bezpośrednio w repozytorium Testownika na GitHubie.",
  },
];

/** The uniperks partner link; `/go/uniperks` adds the placement and redirects here. */
export const PERKS_PARTNER_URL = "https://bit.ly/4zcALip";

/** Which partner section design is live, reported with every perks event. */
export const PERKS_VARIANT = "coupons-uniperks";

/** Where a click on the partner section came from, as `utm_content`. */
export const PERKS_PLACEMENTS = [
  "landing-cta",
  "landing-secondary",
  "landing-card",
] as const;

export type PerksPlacement = (typeof PERKS_PLACEMENTS)[number];

export const PERKS_COPY = {
  eyebrow: "Partner Testownika",
  headline: "Uczysz się za darmo.",
  headlineAccent: "Kupuj taniej.",
  primaryCta: "Odblokuj zniżki!",
  secondaryCta: "Zobacz oferty",
  studentsCaption: "studentów",
  offersCaption: (maxDiscount: string) => `oferty do\u00A0−${maxDiscount}%`,
  savingsCaption: "oszczędności rocznie",
  disclosure:
    "Link partnerski. uniperks to zewnętrzna aplikacja, niezwiązana z Testownikiem. Oferty na kartach są przykładowe — aktualne znajdziesz w aplikacji.",
} as const;

/** The lead paragraph, from already formatted live numbers. */
export function perksLead({
  students,
  offers,
  maxDiscount,
  savings,
}: {
  students: string;
  offers: string;
  maxDiscount: string;
  savings: string;
}): string {
  return `Dołącz do\u00A0${students} studentów, którzy korzystają z\u00A0${offers} zniżek do\u00A0−${maxDiscount}% w\u00A0aplikacji uniperks i\u00A0oszczędzają nawet ${savings}\u00A0zł rocznie.`;
}
