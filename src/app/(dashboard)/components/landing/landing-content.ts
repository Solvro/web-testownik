import { BarChart3, Bot, GraduationCap, Share2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

export interface Capability {
  icon: LucideIcon;
  tag: string;
  title: string;
  text: string;
}

export const SOLVRO_PORTFOLIO_URL =
  "https://solvro.pwr.edu.pl/en/portfolio/testownik/";
export const REPOSITORY_URL = "https://github.com/Solvro/web-testownik";

export const STORY: readonly TimelineEntry[] = [
  {
    date: "CZERWIEC 2024",
    title: "Zaczęło się przed egzaminem z fizyki.",
    text: "Antek zamiast uczyć się z istniejących aplikacji zaczął pisać własny Testownik. Pierwsza wersja powstała jako narzędzie, którego sam potrzebował.",
  },
  {
    date: "DRUGA POŁOWA 2024",
    title: "Pół roku rozwijania solo.",
    text: "Interaktywne quizy, obrazy i powtórki rosły razem z kolejnymi egzaminami. Produkt był używany, zanim stał się projektem zespołowym.",
  },
  {
    date: "ROK AKADEMICKI 2024/25",
    title: "Nowa technologia, Łukasz i Franek.",
    text: "Testownik został przepisany podczas kursu KN Kredek. To wtedy samotny projekt zaczął zamieniać się w platformę.",
  },
  {
    date: "ROK AKADEMICKI 2025/26",
    title: "Testownik dołącza do KN Solvro.",
    text: "Od tego momentu rozwija go cały zespół: frontend, backend, design, infrastruktura i społeczność.",
  },
  {
    date: "DZISIAJ",
    title: `${TEAM_SIZE.toString()} osób i wciąż otwarty kod.`,
    text: "Quizy bez rejestracji, współdzielenie, synchronizacja, statystyki, oceny z USOS i funkcje AI działają jako jeden produkt.",
  },
];

export const CAPABILITIES: readonly Capability[] = [
  {
    icon: BarChart3,
    tag: "STATYSTYKI QUIZU",
    title: "Wiesz, co naprawdę umiesz.",
    text: "Wyniki sesji, czas nauki, aktywność w ciągu doby i pytania, na których najczęściej się mylisz.",
  },
  {
    icon: GraduationCap,
    tag: "OCENY + USOS",
    title: "Średnia bez arkusza.",
    text: "Semestry, ECTS i symulator „co jeśli” liczą prognozę na żywo na prawdziwych danych.",
  },
  {
    icon: Share2,
    tag: "WSPÓŁDZIELENIE",
    title: "Jeden quiz dla całej grupy.",
    text: "Wyślij link, pozwól czytać albo edytować i nie rozsyłaj kolejnych wersji tego samego pliku.",
  },
  {
    icon: Bot,
    tag: "ASYSTENT AI",
    title: "Pomoc zna aktywne pytanie.",
    text: "Wyjaśnienia, wskazówki i poprawki pracują w kontekście quizu, a nie w pustym oknie czatu.",
  },
];
