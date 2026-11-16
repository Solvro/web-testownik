/** Only a report document on our allowlisted origin may send this message. */
export function embeddedSessionExpired(message: string): boolean {
  if (message.length > 256) return false;
  try {
    const value: unknown = JSON.parse(message);
    return (
      value !== null &&
      typeof value === "object" &&
      "type" in value &&
      value.type === "embedded-session-expired"
    );
  } catch {
    return false;
  }
}
