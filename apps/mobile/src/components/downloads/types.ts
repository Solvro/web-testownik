import type { ReactNode } from "react";

export interface SavedListItem {
  id: string;
  title: string;
  detail?: string;
}

export interface SavedListProps {
  /** The screen's Stack.Screen options element. */
  title: ReactNode;
  help: string;
  items: SavedListItem[];
  open: (id: string) => void;
  remove: (id: string) => void;
}
