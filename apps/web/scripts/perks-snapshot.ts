/*
 * Refreshes the partner section's committed fallback from the partner feed
 * (when UNIPERKS_FEED_URL is set) or the public uniperks.pl page:
 *   pnpm --filter web perks:snapshot
 * Leaves the file untouched and exits 1 when neither source is usable.
 */
import { writeFile } from "node:fs/promises";

import { PERKS_PARTNER_URL } from "../src/app/(landing)/components/landing-content";
import {
  loadFeed,
  loadPublicPage,
  perksDataSchema,
} from "../src/app/(landing)/lib/perks";
import type { PerksStep } from "../src/app/(landing)/lib/perks";

const SNAPSHOT_PATH = new URL(
  "../src/app/(landing)/data/perks.snapshot.json",
  import.meta.url,
);

const feedUrl = process.env.UNIPERKS_FEED_URL;
const steps: PerksStep[] = [
  ...(feedUrl === undefined || feedUrl === ""
    ? []
    : [
        {
          source: "feed" as const,
          load: async () =>
            loadFeed({
              url: feedUrl,
              token: process.env.UNIPERKS_FEED_TOKEN,
              fetch,
            }),
        },
      ]),
  {
    source: "public-page",
    load: async () => loadPublicPage({ fetch, partnerUrl: PERKS_PARTNER_URL }),
  },
];

async function refresh(): Promise<boolean> {
  for (const step of steps) {
    try {
      const result = perksDataSchema.safeParse(await step.load());
      if (!result.success) {
        console.warn(`${step.source} rejected:`, result.error.issues);
        continue;
      }
      const data = { ...result.data, source: "snapshot" };
      await writeFile(SNAPSHOT_PATH, `${JSON.stringify(data, null, 2)}\n`);
      console.info(`Snapshot written from ${step.source}.`);
      return true;
    } catch (error) {
      console.warn(`${step.source} failed:`, error);
    }
  }
  return false;
}

if (!(await refresh())) {
  console.error("No usable perks source; snapshot left unchanged.");
  process.exitCode = 1;
}
