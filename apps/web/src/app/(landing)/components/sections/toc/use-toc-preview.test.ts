import { describe, expect, it } from "vitest";

import { HIDDEN_TOC_PREVIEW, tocPreviewReducer } from "./use-toc-preview";
import type { TocPreviewState } from "./use-toc-preview";

const shown: TocPreviewState = { id: "faq", motion: "in", top: 40, left: 210 };

describe("tocPreviewReducer", () => {
  it("shows a section at the given place, interrupting a boom", () => {
    const booming: TocPreviewState = { ...shown, motion: "out" };
    expect(
      tocPreviewReducer(booming, { type: "show", id: "team", top: 5, left: 6 }),
    ).toEqual({ id: "team", motion: "in", top: 5, left: 6 });
  });

  it("booms only a shown peek", () => {
    expect(tocPreviewReducer(shown, { type: "boom" })).toEqual({
      ...shown,
      motion: "out",
    });
    const booming = tocPreviewReducer(shown, { type: "boom" });
    expect(tocPreviewReducer(booming, { type: "boom" })).toBe(booming);
    expect(tocPreviewReducer(HIDDEN_TOC_PREVIEW, { type: "boom" })).toBe(
      HIDDEN_TOC_PREVIEW,
    );
  });

  it("hides, keeping the state when already hidden", () => {
    expect(tocPreviewReducer(shown, { type: "hide" })).toMatchObject({
      id: null,
      motion: "hidden",
    });
    expect(tocPreviewReducer(HIDDEN_TOC_PREVIEW, { type: "hide" })).toBe(
      HIDDEN_TOC_PREVIEW,
    );
  });
});
