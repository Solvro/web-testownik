import { unstable_cache } from "next/cache";
import "server-only";

import { env } from "@/env";

import { PERKS_PARTNER_URL } from "../components/landing-content";
import snapshot from "../data/perks.snapshot.json";
import {
  PERKS_CACHE_TAG,
  PERKS_REVALIDATE_SECONDS,
  loadFeed,
  loadPublicPage,
  perksDataSchema,
  resolvePerks,
} from "./perks";
import type { PerksData, PerksStep } from "./perks";

/*
 * The homepage is over 2 MB, which the fetch data cache refuses to store, so
 * the parsed result is cached instead. Throwing keeps a bad parse out of the
 * cache: the next request tries again.
 */
const loadCachedPublicPage = unstable_cache(
  async () => {
    const data = await loadPublicPage({
      fetch,
      partnerUrl: PERKS_PARTNER_URL,
      init: { cache: "no-store" },
    });
    return perksDataSchema.parse(data);
  },
  ["perks-public-page"],
  { revalidate: PERKS_REVALIDATE_SECONDS, tags: [PERKS_CACHE_TAG] },
);

export function perksSteps(): PerksStep[] {
  const feedUrl = env.UNIPERKS_FEED_URL;
  return [
    ...(feedUrl === undefined
      ? []
      : [
          {
            source: "feed" as const,
            load: async () =>
              loadFeed({
                url: feedUrl,
                token: env.UNIPERKS_FEED_TOKEN,
                fetch,
                init: {
                  next: {
                    revalidate: PERKS_REVALIDATE_SECONDS,
                    tags: [PERKS_CACHE_TAG],
                  },
                },
              }),
          },
        ]),
    { source: "public-page", load: loadCachedPublicPage },
  ];
}

/**
 * Partner numbers and offers: the partner feed, else the public uniperks.pl
 * page, else the committed snapshot. Never rejects.
 */
export async function getPerks(): Promise<PerksData> {
  return resolvePerks(perksSteps(), snapshot);
}
