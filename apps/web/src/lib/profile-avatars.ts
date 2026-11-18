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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** A stable avatar seed that doesn't reveal who the user is to DiceBear. */
export async function getAvatarSeed(userId: string): Promise<string> {
  return await sha256Hex(userId);
}

export async function getGravatarUrl(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length === 0) {
    return null;
  }
  const hash = await sha256Hex(normalizedEmail);
  return `https://gravatar.com/avatar/${hash}?s=256&d=identicon&r=g`;
}
