import seedrandom from "seedrandom";

/**
 * Deterministically shuffles an array using a seed string.
 * Uses Fisher-Yates shuffle algorithm with a seeded PRNG.
 *
 * @param array The array to shuffle
 * @param seed The seed string for the PRNG
 * @returns A new shuffled array (does not mutate original)
 */
export function getDeterministicShuffle<T>(array: T[], seed: string): T[] {
  const prng = seedrandom(seed);
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const index_ = Math.floor(prng() * (index + 1));
    [shuffled[index], shuffled[index_]] = [shuffled[index_], shuffled[index]];
  }

  return shuffled;
}
