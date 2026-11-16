import { Directory, File, Paths } from "expo-file-system";

import type { ExternalDeletionMarkers } from "./deletion-markers";
import { UserFacingError } from "./user-error";

const directory = () =>
  new Directory(Paths.document, "account-deletion-markers.v1");
function encodeOwner(ownerId: string) {
  let encoded = "";
  for (let i = 0; i < ownerId.length; i++) {
    encoded += ownerId.charCodeAt(i).toString(16).padStart(4, "0");
  }
  return encoded;
}

function marker(ownerId: string) {
  if (!ownerId) throw new UserFacingError("operation");
  return new File(directory(), `${encodeOwner(ownerId)}.pending`);
}

// Existence is the durable intent: no JSON/body write can be interrupted.
// These files live outside AsyncStorage's bounded SQLite database, and stay
// until account data, images, credentials and last-user cleanup all finish.
export const externalDeletionMarkers: ExternalDeletionMarkers = {
  supported: true,
  async list() {
    const folder = directory();
    folder.create({ intermediates: true, idempotent: true });
    return folder.list().flatMap((entry) => {
      if (!(entry instanceof File) || !entry.name.endsWith(".pending"))
        return [];
      const encoded = entry.name.slice(0, -".pending".length);
      // Only URI-inert hexadecimal filenames belong to this store. Unknown
      // files cannot identify an owner and must not block every account.
      if (!/^(?:[0-9a-f]{4})+$/.test(encoded)) return [];
      let ownerId = "";
      for (let i = 0; i < encoded.length; i += 4) {
        ownerId += String.fromCharCode(
          Number.parseInt(encoded.slice(i, i + 4), 16),
        );
      }
      return [ownerId];
    });
  },
  async write(ownerId) {
    const folder = directory();
    folder.create({ intermediates: true, idempotent: true });
    const file = marker(ownerId);
    if (!file.exists) file.create();
    // iOS File.create currently ignores a false native createFile result.
    if (!marker(ownerId).exists) throw new UserFacingError("operation");
  },
  async remove(ownerId) {
    // Enumerate to distinguish absent from inaccessible: native exists alone
    // returns false for both. Verify removal before completing the intent.
    if ((await externalDeletionMarkers.list()).includes(ownerId))
      marker(ownerId).delete();
    if ((await externalDeletionMarkers.list()).includes(ownerId))
      throw new UserFacingError("operation");
  },
};
