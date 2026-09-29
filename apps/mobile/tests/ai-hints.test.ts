import { describe, expect, it } from "vitest";
import { parseAiHints } from "../src/lib/ai-hints";
describe("web hint response contract", () => {
  it("renders general and numbered answer hints without protocol tags", () => {
    expect(
      parseAiHints(
        '<general_hint>Compare mechanisms.</general_hint><answer_hints><hint answer="2">Consider the conditions.</hint></answer_hints>',
        3,
      ),
    ).toEqual([
      { key: "general", text: "Compare mechanisms." },
      { key: "answer-1", answerIndex: 1, text: "Consider the conditions." },
    ]);
  });
  it("accepts streamed text and suppresses partial closing tags", () => {
    expect(
      parseAiHints("<general_hint>Look at the field.</general_", 2)[0].text,
    ).toBe("Look at the field.");
    expect(
      parseAiHints('<answer_hints><hint answer="1">Start here.</hi', 2)[0].text,
    ).toBe("Start here.");
    expect(parseAiHints('<answer_hints><hint answer="', 2)).toEqual([]);
  });
  it("rejects nonexistent and duplicate answer indexes", () => {
    expect(
      parseAiHints(
        '<hint answer="0">bad</hint><hint answer="5">bad</hint><hint answer="1">first</hint><hint answer="1">duplicate</hint>',
        2,
      ),
    ).toEqual([{ key: "answer-0", answerIndex: 0, text: "first" }]);
  });
  it("keeps plain-text provider replies readable", () => {
    expect(parseAiHints("A plain hint.", 2)).toEqual([
      { key: "plain", text: "A plain hint." },
    ]);
  });
});
