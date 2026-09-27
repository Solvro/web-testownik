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
  const extension =
    image.type === "image/jpeg" ? "jpg" : image.type.split("/").at(1);
  return new File([image], `avatar.${extension ?? "png"}`, {
    type: image.type,
  });
}

export async function getGravatarUrl(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0) {
    return null;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizedEmail),
  );
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `https://gravatar.com/avatar/${hash}?s=256&d=identicon&r=g`;
}
