"use client";

import { PhoneQuizSurface } from "@/app/(landing)/preview/product-surfaces";

import { useQuizPreviewState } from "../hooks/use-quiz-preview-state";

/**
 * The live quiz inside the mobile hero's CSS iPhone. Its own module because the
 * preview surfaces pull in the real quiz components (Markdown, LaTeX, …); the
 * frame and the headline paint without waiting for them. The surface seals
 * itself in a `PreviewSandbox` and owns its own quiz session. Its phone layout
 * stays fixed even when the outer page is a tablet.
 */
export function HeroPhoneScreen(): React.JSX.Element {
  const session = useQuizPreviewState();

  return <PhoneQuizSurface session={session} />;
}
