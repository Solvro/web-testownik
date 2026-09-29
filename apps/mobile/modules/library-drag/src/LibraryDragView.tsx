import { requireNativeView } from "expo";
import * as React from "react";

import { LibraryDragViewProps } from "./LibraryDrag.types";

const NativeView: React.ComponentType<LibraryDragViewProps> = requireNativeView(
  "LibraryDrag",
  "LibraryDragView",
);

export default function LibraryDragView(props: LibraryDragViewProps) {
  return <NativeView {...props} />;
}
