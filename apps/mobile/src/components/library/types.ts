import type { LibraryItem } from "@testownik/core/quiz/library";

import type { LibraryMove } from "../../../modules/library-drag/src/LibraryDrag.types";
import type { SearchSection } from "../../lib/quiz-search";
import type { MenuAction } from "../header-action";
import type { QuizListActions } from "../quiz-list/types";

export interface LibrarySection {
  key: "folders" | "quizzes" | "storage";
  title: string;
  items: LibraryItem[];
}

export interface SwipeAction extends MenuAction {
  tint?: string;
}

export interface LibraryContentProps {
  sections: LibrarySection[];
  /** The user has typed a search; results replace the folder contents. */
  searching: boolean;
  searchSections: SearchSection[];
  searchLoading: boolean;
  searchError: unknown;
  loading: boolean;
  error: unknown;
  /** `symbol` is an SF Symbol for the iOS empty view; folder when omitted. */
  empty: { title: string; description: string; symbol?: string };
  moving: boolean;
  refresh: () => Promise<unknown>;
  retry: () => void;
  name: (item: LibraryItem) => string;
  detail: (item: LibraryItem) => string | undefined;
  open: (item: LibraryItem) => void;
  /** Long-press menu groups. */
  menu: (item: LibraryItem) => MenuAction[][];
  swipe: (item: LibraryItem) => {
    leading: SwipeAction[];
    trailing: SwipeAction[];
  };
  canDrag: (item: LibraryItem) => boolean;
  /** The web link a dragged row carries. */
  link: (item: LibraryItem) => string;
  /** Top-level switch between your library, shared and recent quizzes. */
  scope?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  canDrop: (item: LibraryItem) => boolean;
  drop: (move: LibraryMove) => void;
  quizActions: QuizListActions;
  backToLibrary?: () => void;
  /** Browser preview only; iOS and Android use the native header search bar. */
  query: string;
  setQuery: (query: string) => void;
}
