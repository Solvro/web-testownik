"use client";

import { PhoneQuizSurface } from "@/components/testownik-preview/product-surfaces";

import { useQuizPreviewState } from "../hooks/use-quiz-preview-state";

/**
 * The live quiz inside the mobile hero's CSS iPhone. Its own module because the
 * preview surfaces pull in the real quiz components (Markdown, LaTeX, …); the
 * frame and the headline paint without waiting for them. The surface seals
 * itself in the same sandbox as the desktop device screens, minus the Glass
 * magnifier, and owns its own quiz session.
 */
export function HeroPhoneScreen(): React.JSX.Element {
  const session = useQuizPreviewState();

  return <PhoneQuizSurface session={session} />;
}
