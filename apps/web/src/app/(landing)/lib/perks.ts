/** Hard-coded partner offer content; no external feed or scraper. */
export interface PerksOffer {
  id: string;
  partner: string;
  title: string;
  category: string;
  channel: string;
  validUntil?: string;
  limited?: boolean;
  badge: { kind: "new" } | { kind: "activations"; value: number };
  url: string;
}

export interface PerksData {
  studentsCount: number;
  offersCount: number;
  maxDiscountPct: number;
  yearlySavingsPln: number;
}
