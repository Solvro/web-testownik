import type { PropsWithChildren } from "react";
import type { ViewProps } from "react-native";

export type LibraryMove = {
  id: string;
  type: "quiz" | "folder" | "shortcut";
  destination: string;
};
export type LibraryDragViewProps = PropsWithChildren<
  ViewProps & {
    itemId: string;
    itemKind: "quiz" | "folder";
    itemName: string;
    dragEnabled: boolean;
    dropEnabled: boolean;
    onMove: (event: { nativeEvent: LibraryMove }) => void;
  }
>;
