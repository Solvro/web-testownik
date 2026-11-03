/**
 * Whether this document can run html-in-canvas (`drawElementImage`), which the
 * Bubble and Glass lenses depend on. False on the server and during hydration,
 * so the plain children are what both render first.
 */
export { useSupportsHtmlInCanvas } from "../../canvasui/runtime/html-in-canvas";
