// Preserve the original profile picker styles and seed variants, using raster
// endpoints so the chosen image can be uploaded through the shared photo API.
const AVATAR_STYLES = [
  ["adventurer", ""],
  ["adventurer", " 2"],
  ["adventurer", " 3"],
  ["dylan", ""],
  ["micah", ""],
  ["micah", " 2"],
  ["shapes", ""],
  ["initials", ""],
] as const;

export function getProfileAvatarOptions(fullName: string) {
  return AVATAR_STYLES.map(([style, suffix]) => {
    const parameters = new URLSearchParams({
      seed: `${fullName || "default"}${suffix}`,
    });
    return `https://api.dicebear.com/9.x/${style}/png?${parameters.toString()}`;
  });
}

export async function fetchProfileAvatar(url: string): Promise<File> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not download the selected avatar");
  }
  const image = await response.blob();
  return new File([image], "avatar.png", { type: "image/png" });
}
