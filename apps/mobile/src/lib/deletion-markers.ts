import { createIndexedDBDeletionMarkers } from "./indexeddb-deletion-markers";

export interface DeletionMarkerSnapshot {
  pending: string[];
  deleted: string[];
}

export interface ExternalDeletionMarkers {
  readonly supported?: boolean;
  list(): Promise<string[]>;
  scan?(): Promise<DeletionMarkerSnapshot>;
  writeDeleted?(ownerId: string): Promise<void>;
  write(ownerId: string): Promise<void>;
  remove(ownerId: string): Promise<void>;
}

// Native platforms resolve the filesystem implementation in .native.ts.
export const externalDeletionMarkers = createIndexedDBDeletionMarkers(
  () => globalThis.indexedDB,
);
