import * as cheerio from "cheerio";
import * as z from "zod";

/*
 * Data for the uniperks partner section. Everything here is pure so the
 * snapshot script can run it outside Next; `perks.server.ts` adds caching
 * and the committed snapshot.
 */

export const PERKS_CHANNELS = [
  "Online",
  "Stacjonarnie",
  "Online i stacjonarnie",
] as const;

export const PERKS_REVALIDATE_SECONDS = 21_600;
export const PERKS_CACHE_TAG = "perks";
export const PERKS_PUBLIC_PAGE_URL = "https://uniperks.pl/";
export const PERKS_USER_AGENT =
  "TestownikBot/1.0 (+https://testownik.solvro.pl)";
/** The only host a feed logo may come from; mirrored in `next.config.ts`. */
export const PERKS_LOGO_HOST = "static.uniperks.pl";

const REQUEST_TIMEOUT_MS = 5000;
const OFFER_COUNT = 3;

const positiveInt = z.number().int().positive();

const perksOfferSchema = z.object({
  id: z.string().trim().min(1),
  partner: z.string().trim().min(1),
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  channel: z.enum(PERKS_CHANNELS),
  validUntil: z.iso.date().optional(),
  /** Shown as "Limitowany" in the meta line, where uniperks puts it. */
  limited: z.boolean().optional(),
  badge: z
    .object({
      kind: z.enum(["limited", "new", "activations"]),
      value: positiveInt.optional(),
    })
    .optional(),
  logoUrl: z
    .url({ protocol: /^https$/, hostname: /^static\.uniperks\.pl$/ })
    .optional(),
  url: z.url(),
});

export const perksDataSchema = z.object({
  studentsCount: positiveInt,
  offersCount: positiveInt,
  maxDiscountPct: z.number().int().min(1).max(100),
  yearlySavingsPln: positiveInt,
  offers: z.array(perksOfferSchema).min(OFFER_COUNT),
  fetchedAt: z.string().min(1),
  source: z.enum(["feed", "public-page", "snapshot"]),
});

export type PerksOffer = z.infer<typeof perksOfferSchema>;
export type PerksData = z.infer<typeof perksDataSchema>;
export type PerksSource = PerksData["source"];

/** A loader for one source; it may throw or return anything. */
export interface PerksStep {
  source: Exclude<PerksSource, "snapshot">;
  load: () => Promise<unknown>;
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tries each step in order and returns the first sane result, falling back to
 * the snapshot. Sane means the schema holds: positive counts and at least
 * three offers with non-empty titles. Steps never throw past this function.
 */
export async function resolvePerks(
  steps: readonly PerksStep[],
  snapshot: unknown,
): Promise<PerksData> {
  for (const step of steps) {
    try {
      const result = perksDataSchema.safeParse(await step.load());
      if (result.success) {
        return { ...result.data, source: step.source };
      }
      console.warn(
        `Perks ${step.source} rejected:`,
        z.prettifyError(result.error),
      );
    } catch (error) {
      console.warn(`Perks ${step.source} failed:`, error);
    }
  }
  return { ...perksDataSchema.parse(snapshot), source: "snapshot" };
}

/** Keeps the valid offers, so one malformed card does not sink the rest. */
function validOffers(offers: readonly unknown[]): PerksOffer[] {
  return offers.flatMap((offer) => {
    const result = perksOfferSchema.safeParse(offer);
    return result.success ? [result.data] : [];
  });
}

// --- Partner feed -----------------------------------------------------------

/**
 * TODO(Andrzej, uniperks): replace with the real feed shape once the partner
 * feed is agreed. Until then the feed is expected to already match
 * `PerksData` minus `source`/`fetchedAt`.
 */
export function normalizeFeed(json: unknown, fetchedAt = today()): unknown {
  if (typeof json !== "object" || json === null) {
    return null;
  }
  const record = json as Record<string, unknown>;
  return {
    ...record,
    offers: validOffers(Array.isArray(record.offers) ? record.offers : []),
    fetchedAt,
    source: "feed",
  };
}

export async function loadFeed({
  url,
  token,
  fetch: fetchImpl,
  init,
}: {
  url: string;
  token?: string;
  fetch: FetchLike;
  init?: RequestInit;
}): Promise<unknown> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": PERKS_USER_AGENT,
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Perks feed responded ${response.status.toString()}`);
  }
  return normalizeFeed(await response.json());
}

// --- robots.txt ---------------------------------------------------------------

function robotsPatternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replaceAll(/[.+?^${}()|[\]\\]/g, String.raw`\$&`))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/**
 * Whether `agent` may fetch `path`, per RFC 9309: the most specific matching
 * group (falling back to `*`), then the longest matching rule, Allow winning
 * ties.
 */
export function isAllowedByRobots(
  robotsTxt: string,
  path: string,
  agent: string,
): boolean {
  const groups: {
    agents: string[];
    rules: { allow: boolean; path: string }[];
  }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (current === null || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current !== null) {
      lastWasAgent = false;
      if (value !== "") {
        current.rules.push({ allow: key === "allow", path: value });
      }
    } else {
      lastWasAgent = false;
    }
  }

  const token = agent.toLowerCase();
  const specific = groups.filter((group) =>
    group.agents.some((name) => name !== "*" && token.includes(name)),
  );
  const applicable =
    specific.length > 0
      ? specific
      : groups.filter((group) => group.agents.includes("*"));
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of applicable.flatMap((group) => group.rules)) {
    if (!robotsPatternMatches(rule.path, path)) {
      continue;
    }
    if (
      best === null ||
      rule.path.length > best.length ||
      (rule.path.length === best.length && rule.allow)
    ) {
      best = { allow: rule.allow, length: rule.path.length };
    }
  }
  return best?.allow ?? true;
}

// --- Public page --------------------------------------------------------------

/** What the page parser could read; any field may be missing. */
export interface ParsedPublicPage {
  studentsCount?: number;
  offersCount?: number;
  maxDiscountPct?: number;
  yearlySavingsPln?: number;
  offers: Partial<PerksOffer>[];
}

/** Carousels that repeat offers from the category rows without a category. */
const UNCATEGORIZED_CAROUSELS = new Set(["popularne", "najnowsze"]);

function toNumber(digits: string | undefined): number | undefined {
  if (digits === undefined) {
    return undefined;
  }
  const value = Number.parseInt(digits.replaceAll(/\D/g, ""), 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function squash(text: string): string {
  return text.replaceAll(/\s+/g, " ").trim();
}

/** uniperks decorates titles with emoji; the landing keeps emoji to badges. */
function stripEmoji(text: string): string {
  return squash(text.replaceAll(/\p{Extended_Pictographic}|️|‍/gu, ""));
}

/** `Do 31.3.2027` → `2027-03-31`. */
function parseValidUntil(feature: string): string | undefined {
  const match = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(feature);
  if (match === null) {
    return undefined;
  }
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Reads the headline numbers and the offers of each category row from
 * uniperks.pl, in page order. Tolerant by design: a missing element leaves its field
 * undefined and the schema decides whether the result is usable.
 */
export function parsePublicPage(
  html: string,
  partnerUrl: string,
): ParsedPublicPage {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const hero = squash($(".hero-title, .hero-subtitle").text());
  const numbers = hero === "" ? squash($("body").text()) : hero;
  const offersMatch = /Ponad\s+([\d\s]+?)\s+benefit/i.exec(numbers);
  const discountMatch = /zniżek[^%]*?do\s+(\d{1,3})\s*%/i.exec(numbers);
  const studentsMatch = /Dołącz do\s+([\d\s]+?)\s+student/i.exec(numbers);
  const savingsMatch = /nawet\s+([\d\s]+?)\s*zł/i.exec(numbers);

  const categoryLabels = new Map<string, string>();
  $('a[href^="/kody-rabatowe-oferty/"]').each((_, link) => {
    const slug = $(link).attr("href")?.split("/").at(-1);
    const label = squash($(link).text());
    if (slug !== undefined && label !== "" && !categoryLabels.has(slug)) {
      categoryLabels.set(slug, label);
    }
  });

  const offers: Partial<PerksOffer>[] = [];
  const seen = new Set<string>();
  $("uni-offers-carousel[category]").each((_, carousel) => {
    const slug = $(carousel).attr("category") ?? "";
    if (UNCATEGORIZED_CAROUSELS.has(slug)) {
      return;
    }
    $(carousel)
      .find("uni-offer-card")
      .each((__, element) => {
        const card = $(element);
        const href =
          card.closest("a").attr("href") ?? card.find("a").attr("href");
        const offerId =
          href === undefined
            ? undefined
            : (new URL(href, PERKS_PUBLIC_PAGE_URL).searchParams.get(
                "offerId",
              ) ?? undefined);
        const features = card
          .find(".feature")
          .toArray()
          .map((feature) => squash($(feature).text()));
        const online = features.includes("Online");
        const stationary = features.includes("Stacjonarnie");
        const limited = features.includes("Limitowany");
        const badgeElement = card.find("uni-offer-badge").first();
        const badgeKind = badgeElement.attr("kind");
        const badgeLabel = squash(badgeElement.find(".label").text());
        const heading = card.find("h4").first();
        const title = stripEmoji(heading.attr("title") ?? heading.text());
        const partner = squash(card.find(".partner-name").first().text());

        const offer: Partial<PerksOffer> = {
          id: offerId ?? (partner === "" ? undefined : `${slug}-${partner}`),
          partner: partner === "" ? undefined : partner,
          title: title === "" ? undefined : title,
          category:
            categoryLabels.get(slug) ??
            (slug === "" ? undefined : capitalize(slug)),
          channel:
            online && stationary
              ? "Online i stacjonarnie"
              : stationary
                ? "Stacjonarnie"
                : online
                  ? "Online"
                  : undefined,
          validUntil: features
            .map((feature) => parseValidUntil(feature))
            .find((date) => date !== undefined),
          limited: limited || undefined,
          badge:
            badgeKind === "hot"
              ? { kind: "activations", value: toNumber(badgeLabel) }
              : badgeKind === "new"
                ? { kind: "new" }
                : limited
                  ? { kind: "limited" }
                  : undefined,
          url: partnerUrl,
        };
        const key = offer.id ?? `${slug}-${offers.length.toString()}`;
        if (!seen.has(key)) {
          seen.add(key);
          offers.push(offer);
        }
      });
  });

  return {
    studentsCount: toNumber(studentsMatch?.[1]),
    offersCount: toNumber(offersMatch?.[1]),
    maxDiscountPct: toNumber(discountMatch?.[1]),
    yearlySavingsPln: toNumber(savingsMatch?.[1]),
    offers,
  };
}

/** The first offer of each category, so the stack shows three kinds of perk. */
export function pickOffers(offers: readonly PerksOffer[]): PerksOffer[] {
  const picked: PerksOffer[] = [];
  for (const offer of offers) {
    if (!picked.some((other) => other.category === offer.category)) {
      picked.push(offer);
    }
  }
  for (const offer of offers) {
    if (!picked.includes(offer)) {
      picked.push(offer);
    }
  }
  return picked.slice(0, OFFER_COUNT);
}

/**
 * Fetches uniperks.pl and parses it, after checking robots.txt allows `/` for
 * our user agent. Throws when disallowed or unreachable.
 */
export async function loadPublicPage({
  fetch: fetchImpl,
  partnerUrl,
  init,
}: {
  fetch: FetchLike;
  partnerUrl: string;
  init?: RequestInit;
}): Promise<unknown> {
  const headers = { "User-Agent": PERKS_USER_AGENT };
  const robots = await fetchImpl(
    new URL("/robots.txt", PERKS_PUBLIC_PAGE_URL).href,
    {
      ...init,
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  // A missing robots.txt allows everything; any other failure is a no.
  if (robots.status !== 404) {
    if (!robots.ok) {
      throw new Error(`robots.txt responded ${robots.status.toString()}`);
    }
    const path = new URL(PERKS_PUBLIC_PAGE_URL).pathname;
    if (!isAllowedByRobots(await robots.text(), path, "TestownikBot")) {
      throw new Error("robots.txt disallows the public page");
    }
  }

  const response = await fetchImpl(PERKS_PUBLIC_PAGE_URL, {
    ...init,
    headers: { ...headers, Accept: "text/html" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`uniperks.pl responded ${response.status.toString()}`);
  }
  const parsed = parsePublicPage(await response.text(), partnerUrl);
  return {
    ...parsed,
    offers: pickOffers(validOffers(parsed.offers)),
    fetchedAt: today(),
    source: "public-page",
  };
}
