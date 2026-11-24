// Raster endpoints let the chosen image be uploaded through the shared photo API.
const AVATAR_STYLES = [
  ["adventurer", ""],
  ["adventurer", " 2"],
  ["adventurer", " 3"],
  ["dylan", ""],
  ["micah", ""],
  ["micah", " 2"], // Gravatar slot; this style is only the fallback when no email is known.
  ["shapes", ""],
  ["initials", ""],
] as const;

const GRAVATAR_SLOT = 5;

/**
 * These values reach DiceBear, so `seed` must be opaque and the full name must
 * never be passed: the initials style draws its seed, so it gets only the letters.
 */
export function getProfileAvatarOptions(
  seed: string,
  initials: string,
  gravatarUrl: string | null,
) {
  return AVATAR_STYLES.map(([style, suffix], index) => {
    if (index === GRAVATAR_SLOT && gravatarUrl !== null) {
      return gravatarUrl;
    }
    const styleSeed =
      style === "initials" ? initials || "default" : `${seed}${suffix}`;
    return `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(styleSeed)}`;
  });
}
