// Public and unauthenticated, so guarded by the in-memory rate limiter instead
// of the usage service.
export const runtime = "nodejs";
export const maxDuration = 30;

export { handleLandingDemoChatRequest as POST } from "@/app/(landing)/lib/landing-demo-chat.server";
