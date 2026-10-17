"use client";

import { PreviewSandbox } from "@/components/testownik-preview/preview-provider";
import { PhoneQuizSurface } from "@/components/testownik-preview/product-surfaces";

import { useQuizPreviewState } from "../hooks/use-quiz-preview-state";

/**
 * The live quiz inside the mobile hero's CSS iPhone. Its own module because the
 * preview surfaces pull in the real quiz components (Markdown, LaTeX, …); the
 * frame and the headline paint without waiting for them. Same sandbox as the
 * desktop device screens, minus the Glass magnifier.
 */
export function HeroPhoneScreen(): React.JSX.Element {
  const quiz = useQuizPreviewState();

  return (
    <PreviewSandbox>
      <PhoneQuizSurface {...quiz} />
    </PreviewSandbox>
  );
}
