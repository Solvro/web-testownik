import { View } from "react-native";
import type { LibraryDragViewProps } from "../../../modules/library-drag/src/LibraryDrag.types";

export default function LibraryDrag({ children, style }: LibraryDragViewProps) {
  return <View style={style}>{children}</View>;
}
