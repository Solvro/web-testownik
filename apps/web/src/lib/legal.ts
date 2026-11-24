import type {
  LegalDocument,
  LegalDocumentKind,
  LegalDocumentVersion,
  LegalDocumentVersionSummary,
} from "@testownik/core/legal/types";
import "server-only";

import { API_URL } from "@/lib/api";

// A newly published version shows up within this many seconds.
const REVALIDATE_SECONDS = 300;

async function fetchLegal<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}/legal/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["legal"] },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(
          `Failed to fetch legal/${path}: ${response.status.toString()}`,
        );
      }
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error fetching legal/${path}:`, error);
    return null;
  }
}

/** Null when the API can't be reached. */
export async function getLegalDocumentSSR(
  kind: LegalDocumentKind,
): Promise<LegalDocument | null> {
  return await fetchLegal<LegalDocument>(`${kind}/`);
}

/** Null when the version doesn't exist or the API can't be reached. */
export async function getLegalVersionSSR(
  kind: LegalDocumentKind,
  version: number,
): Promise<LegalDocumentVersion | null> {
  return await fetchLegal<LegalDocumentVersion>(
    `${kind}/versions/${version.toString()}/`,
  );
}

export async function getLegalArchiveSSR(
  kind: LegalDocumentKind,
): Promise<LegalDocumentVersionSummary[]> {
  return (
    (await fetchLegal<LegalDocumentVersionSummary[]>(`${kind}/versions/`)) ?? []
  );
}
