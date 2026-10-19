/**
 * Public, unauthenticated demo of the app's assistant for the landing page's
 * showcase. Shares the `/ai/landing-demo` rate limits instead of the usage
 * service.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export { handleLandingDemoChatRequest as POST } from "@/lib/ai/landing-demo-chat.server";
