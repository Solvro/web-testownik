import { describe, expect, it } from "vitest";

import { inferChoiceType, typeAfterAnswerEdit } from "./question";

const one = [{ is_correct: true }, { is_correct: false }];
const two = [{ is_correct: true }, { is_correct: true }];

describe("inferChoiceType", () => {
  it("is multiple choice only for several correct answers", () => {
    expect(inferChoiceType(one)).toBe("single_choice");
    expect(inferChoiceType(two)).toBe("multiple_choice");
  });
});

describe("typeAfterAnswerEdit", () => {
  it("keeps multiple choice with one correct answer", () => {
    expect(typeAfterAnswerEdit("multiple_choice", one)).toBe("multiple_choice");
  });

  it("turns single choice into multiple choice for several correct answers", () => {
    expect(typeAfterAnswerEdit("single_choice", one)).toBe("single_choice");
    expect(typeAfterAnswerEdit("single_choice", two)).toBe("multiple_choice");
  });

  it("keeps true/false and open questions", () => {
    expect(typeAfterAnswerEdit("true_false", two)).toBe("true_false");
    expect(typeAfterAnswerEdit("open", two)).toBe("open");
  });
});
