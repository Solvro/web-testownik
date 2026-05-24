import { serwist } from "@serwist/next/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const offlineRevision = createHash("md5")
  .update(readFileSync("public/offline.html", "utf8"))
  .digest("hex");

export default serwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  globIgnores: ["public/offline.html"],
  additionalPrecacheEntries: [
    { url: "/offline.html", revision: offlineRevision },
  ],
});
