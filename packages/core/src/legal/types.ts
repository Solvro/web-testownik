/**
 * Shapes returned by the legal documents API: `GET /api/legal/{kind}/`, the
 * archive under `/api/legal/{kind}/versions/` and `GET /api/legal/pending/`.
 */

export type LegalDocumentKind = "terms" | "privacy";

/** A published version without its text, as listed in the archive. */
export interface LegalDocumentVersionSummary {
  id: string;
  kind: LegalDocumentKind;
  version: number;
  /** ISO 8601; may be in the future for an announced version. */
  effective_from: string;
  /** Terms only: signed-in users confirm this version in a notice. */
  requires_acceptance: boolean;
  /** Privacy policy only: signed-in users are told about this update in a notice. */
  notify_users: boolean;
}

export interface LegalDocumentVersion extends LegalDocumentVersionSummary {
  /** Markdown; headings may end with an `{#anchor}`. */
  content: string;
}

export interface LegalDocument {
  /** Null until the first version applies. */
  current: LegalDocumentVersion | null;
  /** The next version, once it's announced. */
  upcoming: LegalDocumentVersionSummary | null;
}

export interface PendingLegalNotices {
  /** The terms version the user still has to accept. */
  terms: LegalDocumentVersionSummary | null;
  /** The privacy policy update the user hasn't been told about yet. */
  privacy: LegalDocumentVersionSummary | null;
}
