import { describe, expect, it } from "vitest";

import type { AIAvailableModel } from "./models";
import {
  getAiModelLabel,
  getAiModelMetadata,
  getAiModelOptions,
  resolvePreferredAiModel,
} from "./models";

const models: AIAvailableModel[] = [
  { model: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "openai" },
  { model: "grok-4.6", label: "Grok 4.6", provider: "xai" },
];

describe("resolvePreferredAiModel", () => {
  it("keeps a saved model that remains available", () => {
    expect(resolvePreferredAiModel("grok-4.6", models, "gpt-5.6-luna")).toBe(
      "grok-4.6",
    );
  });

  it("follows the backend default when the user has no saved preference", () => {
    expect(resolvePreferredAiModel(null, models, "grok-4.6")).toBe("grok-4.6");
  });

  it("uses the backend default when the saved model is unavailable", () => {
    expect(
      resolvePreferredAiModel("removed-model", models, "gpt-5.6-luna"),
    ).toBe("gpt-5.6-luna");
  });

  it("uses the first available model when no valid default remains", () => {
    expect(resolvePreferredAiModel(null, models, "removed-model")).toBe(
      "gpt-5.6-luna",
    );
  });

  it("returns null for an empty catalog", () => {
    expect(resolvePreferredAiModel("grok-4.6", [], null)).toBeNull();
  });
});

describe("dynamic model metadata", () => {
  it("preserves labels and providers in selector options", () => {
    expect(getAiModelOptions(models)).toEqual([
      { value: "gpt-5.6-luna", label: "GPT-5.6 Luna", provider: "openai" },
      { value: "grok-4.6", label: "Grok 4.6", provider: "xai" },
    ]);
  });

  it("returns metadata only for models present in the live catalog", () => {
    expect(getAiModelMetadata(models, "grok-4.6")).toEqual(models[1]);
    expect(getAiModelMetadata(models, "removed-model")).toBeNull();
  });

  it("uses the display name and safely falls back for unknown models", () => {
    expect(getAiModelLabel(models, "gpt-5.6-luna")).toBe("GPT-5.6 Luna");
    expect(getAiModelLabel(models, "retired-model")).toBe("retired-model");
    expect(getAiModelLabel(models, null)).toBe("Nieznany model");
  });
});
