export type AiModelProvider = "anthropic" | "openai" | "xai";

export interface AIAvailableModel {
  model: string;
  label: string;
  provider: AiModelProvider;
}

export interface AIModelsResponse {
  default_model: string | null;
  fallback_model: AIAvailableModel | null;
  models: AIAvailableModel[];
}

export interface AiModelOption {
  label: string;
  provider: AiModelProvider;
  value: string;
}

export function getAiModelOptions(
  models: readonly AIAvailableModel[],
): AiModelOption[] {
  return models.map((model) => ({
    value: model.model,
    label: model.label,
    provider: model.provider,
  }));
}

export function getAiModelMetadata(
  models: readonly AIAvailableModel[],
  value: string | null | undefined,
) {
  return models.find((model) => model.model === value) ?? null;
}

export function getAiModelLabel(
  models: readonly AIAvailableModel[],
  value: string | null | undefined,
) {
  return getAiModelMetadata(models, value)?.label ?? value ?? "Nieznany model";
}

export function resolvePreferredAiModel(
  value: string | null | undefined,
  models: readonly AIAvailableModel[],
  defaultModel: string | null,
) {
  if (models.some((model) => model.model === value)) {
    return value ?? null;
  }
  if (models.some((model) => model.model === defaultModel)) {
    return defaultModel;
  }
  return models.at(0)?.model ?? null;
}
