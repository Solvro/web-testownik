/**
 * Shared contract for the public landing-page AI demo (`/ai/landing-demo`).
 * Kept free of server-only imports so the client can reuse the limits.
 */

export const LANDING_DEMO_ENDPOINT = "/ai/landing-demo";

export const LANDING_DEMO_LIMITS = {
  /** Messages in the history sent with one request (user + assistant). */
  maxMessages: 6,
  /** Characters per user message. */
  maxUserMessageLength: 400,
  /** Characters per assistant message echoed back as history. */
  maxAssistantMessageLength: 1200,
} as const;

export interface LandingDemoMessage {
  role: "assistant" | "user";
  content: string;
}

export interface LandingDemoRequest {
  messages: LandingDemoMessage[];
}

function isLandingDemoMessage(value: unknown): value is LandingDemoMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { role, content } = value as Record<string, unknown>;
  if (typeof content !== "string" || content.trim() === "") {
    return false;
  }
  if (role === "user") {
    return content.length <= LANDING_DEMO_LIMITS.maxUserMessageLength;
  }
  if (role === "assistant") {
    return content.length <= LANDING_DEMO_LIMITS.maxAssistantMessageLength;
  }
  return false;
}

/**
 * Accepts `{ messages }` (short history ending with a user turn) or
 * `{ prompt }` (a single user turn). Anything else, including unknown keys'
 * oversized values, is rejected so the public endpoint stays cheap.
 */
export function parseLandingDemoRequest(
  value: unknown,
): LandingDemoRequest | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const body = value as Record<string, unknown>;
  const hasPrompt = "prompt" in body;
  const hasMessages = "messages" in body;
  if (hasPrompt === hasMessages) {
    return null;
  }

  const messages: unknown = hasPrompt
    ? [{ role: "user", content: body.prompt }]
    : body.messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > LANDING_DEMO_LIMITS.maxMessages ||
    !messages.every((message) => isLandingDemoMessage(message))
  ) {
    return null;
  }
  if (messages.at(-1)?.role !== "user") {
    return null;
  }

  return {
    messages: messages.map(({ role, content }) => ({
      role,
      content: content.trim(),
    })),
  };
}
