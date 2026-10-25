import "server-only";

/**
 * In-memory sliding-window rate limiter (the pre-usage-service "legacy" AI
 * limiter). State lives in the server process, so limits are per instance and
 * reset on restart: good enough for guarding public, unauthenticated demos.
 */

export interface RateLimitOptions {
  limit: number;
  /** Window length in seconds. */
  window: number;
  /** Only for fixed, server-defined buckets; never for client-controlled keys. */
  nonEvictable?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

const rateLimitEntries = new Map<string, number[]>();
const nonEvictableEntries = new Map<string, number[]>();

function getEntries(options: RateLimitOptions) {
  return options.nonEvictable === true ? nonEvictableEntries : rateLimitEntries;
}
const CLEANUP_INTERVAL_MS = 60_000;
/** Upper bound on distinct keys kept in memory; the oldest bucket is dropped past it. */
const MAX_ENTRIES = 5000;

let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const entries of [rateLimitEntries, nonEvictableEntries]) {
    for (const [key, timestamps] of entries) {
      const activeTimestamps = timestamps.filter(
        (timestamp) => timestamp > now,
      );
      if (activeTimestamps.length === 0) {
        entries.delete(key);
      } else {
        entries.set(key, activeTimestamps);
      }
    }
  }
  lastCleanup = now;
}

export function checkRateLimit(
  key: string,
  scope: string,
  options: RateLimitOptions,
): RateLimitResult {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.window)) * 1000;
  const now = Date.now();
  const entryKey = `${scope}:${key}`;

  cleanup(now);
  const entries = getEntries(options);

  const activeTimestamps = (entries.get(entryKey) ?? []).filter(
    (timestamp) => timestamp > now,
  );

  if (activeTimestamps.length >= limit) {
    const reset = activeTimestamps[0] ?? now + windowMs;
    return {
      allowed: false,
      limit,
      remaining: 0,
      reset,
      retryAfter: Math.max(1, Math.ceil((reset - now) / 1000)),
    };
  }

  const reset = now + windowMs;
  activeTimestamps.push(reset);
  if (
    entries === rateLimitEntries &&
    !entries.has(entryKey) &&
    entries.size >= MAX_ENTRIES
  ) {
    const oldestKey = rateLimitEntries.keys().next().value;
    if (oldestKey !== undefined) {
      rateLimitEntries.delete(oldestKey);
    }
  }
  entries.set(entryKey, activeTimestamps);

  const oldestReset = activeTimestamps[0] ?? reset;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - activeTimestamps.length),
    reset: oldestReset,
    retryAfter: Math.max(1, Math.ceil((oldestReset - now) / 1000)),
  };
}

/** Reports whether a request would currently be admitted, without counting it. */
export function peekRateLimit(
  userId: string,
  scope: string,
  options: RateLimitOptions,
): RateLimitResult {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.window)) * 1000;
  const now = Date.now();
  const activeTimestamps = (
    getEntries(options).get(`${scope}:${userId}`) ?? []
  ).filter((timestamp) => timestamp > now);
  const oldestReset = activeTimestamps[0] ?? now + windowMs;
  return {
    allowed: activeTimestamps.length < limit,
    limit,
    remaining: Math.max(0, limit - activeTimestamps.length),
    reset: oldestReset,
    retryAfter: Math.max(1, Math.ceil((oldestReset - now) / 1000)),
  };
}

/**
 * Rolls back the latest successful check. Call synchronously, without an await
 * between reserving and releasing, so another request cannot own that entry.
 */
export function releaseRateLimit(
  key: string,
  scope: string,
  options: RateLimitOptions,
): void {
  getEntries(options).get(`${scope}:${key}`)?.pop();
}

export function createRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
  };
}

export function createRateLimitExceededResponse(result: RateLimitResult) {
  return new Response(
    `Osiągnięto limit zapytań AI. Spróbuj ponownie za ${result.retryAfter.toString()} s.`,
    {
      status: 429,
      headers: {
        ...createRateLimitHeaders(result),
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": result.retryAfter.toString(),
      },
    },
  );
}

export function resetRateLimitStore() {
  rateLimitEntries.clear();
  nonEvictableEntries.clear();
  lastCleanup = Date.now();
}
