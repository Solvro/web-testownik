import type { GradesContentProps } from "./GradesContent.types";

// Only Android renders this layout (GradesContent.android.tsx); iOS and the
// browser preview keep the layout inside app/(tabs)/grades/index.tsx.
export default function GradesContent(_props: GradesContentProps) {
  return null;
}
