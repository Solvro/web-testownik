import {
  createModifier,
  createModifierWithEventListener,
} from "@expo/ui/swift-ui/modifiers";

import type { LibraryMove } from "./LibraryDrag.types";

/**
 * Lets a SwiftUI library row be dragged as its web link: onto a folder row to
 * move it, or into any text field (in or out of the app) as a link.
 */
export const libraryDraggable = (params: { url: string; enabled?: boolean }) =>
  createModifier("libraryDraggable", params);

/** Marks a SwiftUI folder row as a place to drop library rows. */
export const libraryDropDestination = (params: {
  id: string;
  enabled?: boolean;
}) => createModifier("libraryDropDestination", params);

/**
 * Applied to the list: SwiftUI lists don't deliver drops to rows, so the list
 * accepts the drop and reports which marked folder is under it.
 */
export const libraryDropZone = (onDrop: (move: LibraryMove) => void) =>
  createModifierWithEventListener("libraryDropZone", onDrop, {});
