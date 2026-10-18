/**
 * Public, unauthenticated AI demo for the landing page. Guarded by the
 * in-memory per-IP + global rate limiter instead of the usage service.
 */
export const maxDuration = 20;

export { handleLandingDemoRequest as POST } from "@/lib/ai/landing-demo.server";
