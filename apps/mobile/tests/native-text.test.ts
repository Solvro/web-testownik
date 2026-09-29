import { describe, expect, it } from "vitest";
import { NativeTextBinding } from "../src/lib/native-text";

describe("native text synchronization", () => {
  it("does not overwrite newer keystrokes when older React renders arrive", () => {
    const binding = new NativeTextBinding();
    binding.typed("Na");
    binding.typed("Nat");
    binding.typed("Native Material 3");
    expect(binding.shouldApply("Na")).toBe(false);
    expect(binding.shouldApply("Nat")).toBe(false);
    expect(binding.shouldApply("Native Material 3")).toBe(false);
    expect(binding.shouldApply("")).toBe(true);
  });
  it("accepts external changes and handles a batched echo or backspace", () => {
    const binding = new NativeTextBinding();
    binding.typed("a");
    binding.typed("ab");
    binding.typed("a");
    expect(binding.shouldApply("a")).toBe(false);
    expect(binding.shouldApply("Another question")).toBe(true);
    binding.typed("Another question!");
    expect(binding.shouldApply("Another question!")).toBe(false);
  });
});
