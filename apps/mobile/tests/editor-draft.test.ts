import { describe, expect, it } from "vitest";
import type { Quiz } from "@testownik/core/quiz/types";
import {
  editorDraftFromQuiz,
  restoreEditorDraft,
} from "../src/lib/editor-draft";

const content = { title: "Local work", description: "", questions: [] };
describe("editor draft version migration", () => {
  it("keeps the explicit original version instead of incidental quiz metadata", () => {
    expect(
      restoreEditorDraft({
        ...content,
        schemaVersion: 1,
        baseVersion: 2,
        version: 9,
      }),
    ).toEqual({ ...content, schemaVersion: 1, baseVersion: 2 });
  });
  it("migrates a legacy full-quiz draft without guessing the current server version", () => {
    expect(restoreEditorDraft({ ...content, version: 3 })).toEqual({
      ...content,
      schemaVersion: 1,
      baseVersion: 3,
    });
    expect(restoreEditorDraft(content)).toEqual({
      ...content,
      schemaVersion: 1,
    });
  });
  it("does not treat malformed or future schema versions as a valid base", () => {
    for (const version of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      "3",
      null,
    ]) {
      expect(
        restoreEditorDraft({ ...content, version }).baseVersion,
      ).toBeUndefined();
    }
    expect(
      restoreEditorDraft({ ...content, schemaVersion: 1, version: 3 })
        .baseVersion,
    ).toBeUndefined();
  });
  it("records the server version when starting from a saved quiz", () => {
    expect(
      editorDraftFromQuiz({
        ...content,
        id: "fixture",
        version: 4,
        visibility: 0,
        allow_anonymous: false,
        is_anonymous: false,
      } satisfies Quiz),
    ).toEqual({ ...content, schemaVersion: 1, baseVersion: 4 });
  });
  it("normalizes nullable server and legacy draft descriptions to editable text", () => {
    const nullable = {
      ...content,
      id: "fixture",
      version: 2,
      description: null,
      visibility: 0,
      allow_anonymous: false,
      is_anonymous: false,
    } as unknown as Quiz;
    expect(editorDraftFromQuiz(nullable).description).toBe("");
    expect(restoreEditorDraft(nullable).description).toBe("");
  });
});
