import "server-only";

export interface RateLimitOptions {
  limit: number;
  window: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
}

const rateLimitEntries = new Map<string, number[]>();
const CLEANUP_INTERVAL_MS = 60_000;

let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const [key, timestamps] of rateLimitEntries) {
    const activeTimestamps = timestamps.filter((timestamp) => timestamp > now);
    if (activeTimestamps.length === 0) {
      rateLimitEntries.delete(key);
    } else {
      rateLimitEntries.set(key, activeTimestamps);
    }
  }

  lastCleanup = now;
}

export function checkRateLimit(
  userId: string,
  scope: string,
  options: RateLimitOptions,
): RateLimitResult {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.window)) * 1000;
  const now = Date.now();
  const key = `${scope}:${userId}`;

  cleanup(now);

  const activeTimestamps = (rateLimitEntries.get(key) ?? []).filter(
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
  rateLimitEntries.set(key, activeTimestamps);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - activeTimestamps.length),
    reset: activeTimestamps[0] ?? reset,
    retryAfter: Math.max(
      1,
      Math.ceil(((activeTimestamps[0] ?? reset) - now) / 1000),
    ),
  };
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
  const headers = createRateLimitHeaders(result);
  return new Response(
    `Osiągnięto limit zapytań AI. Spróbuj ponownie za ${result.retryAfter.toString()} s.`,
    {
      status: 429,
      headers: {
        ...headers,
        "Retry-After": result.retryAfter.toString(),
      },
    },
  );
}

export function resetRateLimitStore() {
  rateLimitEntries.clear();
  lastCleanup = Date.now();
}
