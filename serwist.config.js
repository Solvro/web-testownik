import { serwist } from "@serwist/next/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const offlineRevision = createHash("md5")
  .update(readFileSync("public/offline.html", "utf8"))
  .digest("hex");

export const serwistConfig = serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // public/*.html is mapped to /public/* by Serwist manifestTransforms (404).
  globIgnores: ["public/offline.html"],
  additionalPrecacheEntries: [
    { url: "/offline.html", revision: offlineRevision },
  ],
});
