import "server-only";

export type DemoTokenCounter = (text: string) => number;

const fallback: DemoTokenCounter = (text) =>
  Math.ceil(Buffer.byteLength(text, "utf8") * 1.3);

// Next bundles instrumentation and route handlers separately. Share the promise
// across those module copies, otherwise startup would warm a different encoder.
const processState = globalThis as typeof globalThis & {
  __testownikLandingDemoTokenizer?: {
    counterPromise?: Promise<DemoTokenCounter>;
  };
};
const state = (processState.__testownikLandingDemoTokenizer ??= {});

/** Optional startup work; requests still share the same lazy load. */
export async function warmLandingDemoTokenizer(): Promise<void> {
  await getLandingDemoTokenCounter();
}

/** Local ranks only: no network fetch, and concurrent requests share one load. */
export async function getLandingDemoTokenCounter(): Promise<DemoTokenCounter> {
  state.counterPromise ??= Promise.all([
    import("js-tiktoken/lite"),
    import("js-tiktoken/ranks/o200k_base"),
  ])
    .then(([{ Tiktoken }, { default: ranks }]) => {
      const tokenizer = new Tiktoken(ranks);
      // Admission/prepareStep/stopWhen repeatedly count the same content. Keep
      // a bounded cache (at most 64 * 8192 UTF-16 code units) across those checks.
      const counts = new Map<string, number>();
      return (text: string) => {
        const cached = counts.get(text);
        if (cached !== undefined) {
          return cached;
        }
        // Special-token-looking user input is ordinary text, never a control token.
        const count = tokenizer.encode(text, [], []).length;
        if (text.length <= 8192) {
          if (counts.size >= 64) {
            counts.clear();
          }
          counts.set(text, count);
        }
        return count;
      };
    })
    .catch(() => {
      // This catch belongs to the shared promise, so a failed warm-up or lazy
      // load logs once and every caller keeps the conservative fallback.
      console.warn("Landing demo tokenizer unavailable; using byte fallback");
      return fallback;
    });
  return state.counterPromise;
}
