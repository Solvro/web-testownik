export function embeddedPath({
  quizId,
  global = false,
}: {
  quizId?: string;
  global?: boolean;
}): string {
  return quizId
    ? `/quiz/${encodeURIComponent(quizId)}/stats`
    : `/wrapped${global ? "/global" : ""}`;
}
export function canNavigateEmbedded(
  url: string,
  origin: string,
  destination: string,
): boolean {
  if (url === "about:blank") return true;
  try {
    const parsed = new URL(url);
    return (
      parsed.origin === new URL(origin).origin &&
      (parsed.pathname === "/auth/mobile" ||
        parsed.pathname === destination ||
        parsed.pathname === `${destination}/`)
    );
  } catch {
    return false;
  }
}
