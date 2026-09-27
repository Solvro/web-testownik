// Preserve the original profile picker styles and seed variants, using raster
// endpoints so the chosen image can be uploaded through the shared photo API.
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

export function getProfileAvatarOptions(
  fullName: string,
  gravatarUrl: string | null,
) {
  return AVATAR_STYLES.map(([style, suffix], index) => {
    if (index === GRAVATAR_SLOT && gravatarUrl !== null) {
      return gravatarUrl;
    }
    const seed = encodeURIComponent(`${fullName || "default"}${suffix}`);
    return `https://api.dicebear.com/9.x/${style}/png?seed=${seed}`;
  });
}
