import type { LegalDocumentKind } from "@testownik/core/legal/types";

export const LEGAL_PAGES: Record<
  LegalDocumentKind,
  { path: string; title: string }
> = {
  terms: { path: "/terms", title: "Regulamin serwisu Testownik" },
  privacy: { path: "/privacy-policy", title: "Polityka Prywatności" },
};

export function formatLegalDate(iso: string): string {
  return `${new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Warsaw",
  })} r.`;
}
