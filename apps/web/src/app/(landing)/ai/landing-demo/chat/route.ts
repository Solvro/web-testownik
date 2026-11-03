/**
 * Public, unauthenticated demo of the app's assistant for the landing page's
 * showcase. Guarded by the in-memory per-IP + global rate limiter instead of
 * the usage service.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export { handleLandingDemoChatRequest as POST } from "@/app/(landing)/lib/landing-demo-chat.server";
