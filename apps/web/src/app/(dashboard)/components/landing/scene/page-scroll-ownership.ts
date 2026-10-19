/** Wheel/scroll events within one gesture arrive at least this often. */
const NATIVE_CHAIN_MS = 100;

/**
 * All device frames scroll the same page. Observing a programmatic scroll
 * must not consume its ownership: every frame receives the same scroll event.
 * Keep its actual target briefly, so clamping and fractional scrolls agree,
 * but a later native gesture at the same position is not mistaken for ours.
 */
export function createPageScrollOwnership() {
  let forwarded: { x: number; y: number; at: number } | null = null;
  let foreignScrollAt = Number.NEGATIVE_INFINITY;

  return {
    recordForwardedScroll(x: number, y: number, now: number): void {
      forwarded = { x, y, at: now };
    },
    observePageScroll(x: number, y: number, now: number): void {
      if (
        forwarded !== null &&
        x === forwarded.x &&
        y === forwarded.y &&
        now - forwarded.at < NATIVE_CHAIN_MS
      ) {
        return;
      }
      foreignScrollAt = now;
    },
    isNativeChaining(now: number): boolean {
      return now - foreignScrollAt < NATIVE_CHAIN_MS;
    },
  };
}

/** Shared by laptop, phone and tablet in the parent page's JS realm. */
export const pageScrollOwnership = createPageScrollOwnership();
