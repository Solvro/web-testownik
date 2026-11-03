"use client";

import { PhoneQuizSurface } from "@/app/(landing)/preview/product-surfaces";

import { useQuizPreviewState } from "../hooks/use-quiz-preview-state";

/**
 * The live quiz inside the mobile hero's iPhone. A separate chunk because the
 * real quiz components (Markdown, LaTeX) are heavy; the frame paints first.
 */
export function HeroPhoneScreen(): React.JSX.Element {
  const session = useQuizPreviewState();

  return <PhoneQuizSurface session={session} />;
}
