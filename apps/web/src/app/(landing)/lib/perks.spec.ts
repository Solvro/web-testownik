import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import snapshot from "../data/perks.snapshot.json";
import {
  isAllowedByRobots,
  loadFeed,
  loadPublicPage,
  parsePublicPage,
  perksDataSchema,
  pickOffers,
  resolvePerks,
} from "./perks";
import type { FetchLike, PerksOffer } from "./perks";

const mocks = vi.hoisted(() => ({
  env: { UNIPERKS_FEED_URL: undefined as string | undefined },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("next/cache", () => ({
  unstable_cache: <T>(load: () => Promise<T>) => load,
}));

const PARTNER_URL = "https://bit.ly/4zcALip";
const fixture = readFileSync(
  path.join(import.meta.dirname, "__fixtures__/uniperks-home.html"),
  "utf8",
);
const ROBOTS = `User-agent: *
Disallow: /profile/
Disallow: /oferty-kody-rabatowe/*/znizka/
Allow: /oferty-kody-rabatowe/
`;

function respond(body: string, status = 200): Response {
  return new Response(body, { status });
}

/** A fetch that serves uniperks.pl from the fixture and fails everything else. */
function pageFetch({
  robots = ROBOTS,
  page = fixture,
}: { robots?: string; page?: string } = {}): FetchLike {
  return vi.fn(async (input: string) => {
    await Promise.resolve();
    if (input.endsWith("/robots.txt")) {
      return respond(robots);
    }
    if (input === "https://uniperks.pl/") {
      return respond(page);
    }
    return respond("", 503);
  });
}

describe("parsePublicPage", () => {
  const parsed = parsePublicPage(fixture, PARTNER_URL);

  it("reads the headline numbers from the hero, not the meta description", () => {
    expect(parsed).toMatchObject({
      studentsCount: 563_760,
      offersCount: 293,
      maxDiscountPct: 50,
      yearlySavingsPln: 2000,
    });
  });

  it("reads category rows only, with their labels", () => {
    const partners = parsed.offers.map((offer) => offer.partner);
    expect(partners).not.toContain("Uber Eats");
    expect(parsed.offers.map((offer) => offer.category)).toEqual(
      expect.arrayContaining(["Jedzenie", "Technologia", "Moda", "Uroda"]),
    );
  });

  it("reads the card anatomy and strips their emoji from titles", () => {
    const starbucks = parsed.offers.find(
      (offer) => offer.partner === "Starbucks",
    );
    expect(starbucks).toMatchObject({
      title: "20% Zniżki Studenckiej na Napoje z Oferty Core",
      category: "Jedzenie",
      channel: "Stacjonarnie",
      badge: { kind: "activations", value: expect.any(Number) as number },
      url: PARTNER_URL,
    });
    expect(starbucks?.id).toMatch(/\d+$/);
    for (const offer of parsed.offers) {
      expect(offer.title).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("reads dates, both channels and the new badge", () => {
    expect(
      parsed.offers.find((offer) => offer.partner === "Media Expert"),
    ).toMatchObject({ channel: "Online", validUntil: "2026-12-31" });
    expect(
      parsed.offers.find((offer) => offer.badge?.kind === "new"),
    ).toBeDefined();
  });

  it("leaves a missing field undefined instead of throwing", () => {
    const pizzaHut = parsed.offers.find(
      (offer) => offer.partner === "Pizza Hut",
    );
    expect(pizzaHut?.channel).toBeUndefined();
    expect(parsePublicPage("<html><body></body></html>", PARTNER_URL)).toEqual({
      studentsCount: undefined,
      offersCount: undefined,
      maxDiscountPct: undefined,
      yearlySavingsPln: undefined,
      offers: [],
    });
  });

  it("reads Limitowany as a flag and a badge when no other badge is set", () => {
    const html = `<uni-offers-carousel category="moda"><a href="/o?offerId=x-1"><uni-offer-card>
      <span class="partner-name">Zalando</span><h4 title="Dodatkowe 20%">Dodatkowe 20%</h4>
      <span class="feature">Limitowany</span><span class="feature">Online</span>
    </uni-offer-card></a></uni-offers-carousel>`;
    expect(parsePublicPage(html, PARTNER_URL).offers[0]).toMatchObject({
      id: "x-1",
      category: "Moda",
      limited: true,
      badge: { kind: "limited" },
    });
  });
});

function makeOffer(id: string, category: string): PerksOffer {
  return {
    id,
    partner: id,
    title: id,
    category,
    channel: "Online",
    url: PARTNER_URL,
  };
}

describe("pickOffers", () => {
  it("takes the first offer of each category, then fills up", () => {
    expect(
      pickOffers([
        makeOffer("a", "Jedzenie"),
        makeOffer("b", "Jedzenie"),
        makeOffer("c", "Moda"),
      ]).map(({ id }) => id),
    ).toEqual(["a", "c", "b"]);
  });
});

describe("isAllowedByRobots", () => {
  it("allows the homepage under the live rules", () => {
    expect(isAllowedByRobots(ROBOTS, "/", "TestownikBot")).toBe(true);
    expect(isAllowedByRobots(ROBOTS, "/profile/me", "TestownikBot")).toBe(
      false,
    );
  });

  it("prefers our own group and the longest rule", () => {
    const robots = `User-agent: *\nAllow: /\n\nUser-agent: TestownikBot\nDisallow: /\n`;
    expect(isAllowedByRobots(robots, "/", "TestownikBot")).toBe(false);
    expect(
      isAllowedByRobots("User-agent: *\nDisallow: /\nAllow: /$", "/", "x"),
    ).toBe(true);
  });
});

describe("loaders", () => {
  it("loads a sane result from the public page", async () => {
    const data = perksDataSchema.parse(
      await loadPublicPage({ fetch: pageFetch(), partnerUrl: PARTNER_URL }),
    );
    expect(data.source).toBe("public-page");
    expect(new Set(data.offers.map((offer) => offer.category)).size).toBe(3);
  });

  it("skips the page when robots.txt disallows it", async () => {
    const fetchImpl = pageFetch({ robots: "User-agent: *\nDisallow: /" });
    await expect(
      loadPublicPage({ fetch: fetchImpl, partnerUrl: PARTNER_URL }),
    ).rejects.toThrow(/robots/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends the feed token", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValue(respond(JSON.stringify(snapshot)));
    const data = perksDataSchema.parse(
      await loadFeed({
        url: "https://feed.example/perks",
        token: "secret",
        fetch: fetchImpl,
      }),
    );
    expect(data.source).toBe("feed");
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });
});

describe("resolvePerks", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => null);
  });

  it("falls back feed → page → snapshot", async () => {
    const feed = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValue(new Error("down"));
    // Parses, but is not sane: no offers.
    const page = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ ...snapshot, offers: [], source: "public-page" });
    const data = await resolvePerks(
      [
        { source: "feed", load: feed },
        { source: "public-page", load: page },
      ],
      snapshot,
    );
    expect(feed).toHaveBeenCalledOnce();
    expect(page).toHaveBeenCalledOnce();
    expect(data.source).toBe("snapshot");
    expect(data.studentsCount).toBe(563_760);
  });

  it("uses the first sane step", async () => {
    const load = vi.fn();
    const data = await resolvePerks(
      [
        {
          source: "feed",
          load: vi
            .fn<() => Promise<unknown>>()
            .mockResolvedValue({ ...snapshot, studentsCount: 1 }),
        },
        { source: "public-page", load },
      ],
      snapshot,
    );
    expect(data).toMatchObject({ source: "feed", studentsCount: 1 });
    expect(load).not.toHaveBeenCalled();
  });

  it("commits a valid snapshot", () => {
    expect(perksDataSchema.safeParse(snapshot).success).toBe(true);
  });
});

describe("getPerks", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => null);
  });

  it("uses the snapshot when the feed and the page both fail", async () => {
    mocks.env.UNIPERKS_FEED_URL = "https://feed.example/perks";
    const fetchMock = vi
      .fn<(input: string) => Promise<Response>>()
      .mockImplementation(async () => {
        await Promise.resolve();
        return respond("", 503);
      });
    vi.stubGlobal("fetch", fetchMock);
    const { getPerks } = await import("./perks.server");

    const data = await getPerks();

    expect(data.source).toBe("snapshot");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://feed.example/perks",
      "https://uniperks.pl/robots.txt",
    ]);
    vi.unstubAllGlobals();
    mocks.env.UNIPERKS_FEED_URL = undefined;
  });
});
