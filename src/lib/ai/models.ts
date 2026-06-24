import { ACCOUNT_LEVEL } from "@/types/user";
import type { AccountLevel } from "@/types/user";

export const AI_MODEL = {
  GPT_54: "gpt-5.4",
  GPT_54_MINI: "gpt-5.4-mini",
  GPT_55: "gpt-5.5",
  GROK_43: "grok-4.3",
  CLAUDE_FABLE_5: "claude-fable-5",
  CLAUDE_OPUS_4_8: "claude-opus-4-8",
  CLAUDE_SONNET_4_6: "claude-sonnet-4-6",
  CLAUDE_HAIKU_4_5: "claude-haiku-4-5",
} as const;

export type AiModel = (typeof AI_MODEL)[keyof typeof AI_MODEL];
export type SelectableAiModel =
  | typeof AI_MODEL.GPT_54_MINI
  | typeof AI_MODEL.GPT_55
  | typeof AI_MODEL.GPT_54
  | typeof AI_MODEL.GROK_43
  | typeof AI_MODEL.CLAUDE_OPUS_4_8
  | typeof AI_MODEL.CLAUDE_SONNET_4_6
  | typeof AI_MODEL.CLAUDE_HAIKU_4_5;
export type AiModelProvider = "Anthropic" | "OpenAI" | "xAI";

export interface AiModelOption {
  label: string;
  provider: AiModelProvider;
  value: SelectableAiModel;
}

export const DEFAULT_AI_MODEL = AI_MODEL.GPT_54_MINI;
export const DEFAULT_SELECTABLE_AI_MODEL = DEFAULT_AI_MODEL;

export const SELECTABLE_AI_MODEL_OPTIONS = [
  {
    value: AI_MODEL.GPT_54_MINI,
    label: "GPT-5.4 mini",
    provider: "OpenAI",
  },
  {
    value: AI_MODEL.GPT_55,
    label: "GPT-5.5",
    provider: "OpenAI",
  },
  {
    value: AI_MODEL.GPT_54,
    label: "GPT-5.4",
    provider: "OpenAI",
  },
  {
    value: AI_MODEL.GROK_43,
    label: "Grok 4.3",
    provider: "xAI",
  },
  {
    value: AI_MODEL.CLAUDE_OPUS_4_8,
    label: "Claude Opus 4.8",
    provider: "Anthropic",
  },
  {
    value: AI_MODEL.CLAUDE_SONNET_4_6,
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
  },
  {
    value: AI_MODEL.CLAUDE_HAIKU_4_5,
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
  },
] as const satisfies readonly AiModelOption[];

const AI_MODELS = new Set<AiModel>(Object.values(AI_MODEL));
const SELECTABLE_AI_MODELS = new Set<SelectableAiModel>(
  SELECTABLE_AI_MODEL_OPTIONS.map((option) => option.value),
);
const BASIC_SELECTABLE_AI_MODELS = new Set<SelectableAiModel>([
  AI_MODEL.GPT_54_MINI,
]);

const SILVER_SELECTABLE_AI_MODELS = new Set<SelectableAiModel>([
  AI_MODEL.GPT_54_MINI,
  AI_MODEL.GPT_54,
  AI_MODEL.GROK_43,
]);

function getSelectableAiModelSetForAccountLevel(
  accountLevel?: AccountLevel | null,
) {
  switch (accountLevel) {
    case ACCOUNT_LEVEL.GOLD: {
      return SELECTABLE_AI_MODELS;
    }
    case ACCOUNT_LEVEL.SILVER: {
      return SILVER_SELECTABLE_AI_MODELS;
    }
    case ACCOUNT_LEVEL.BASIC:
    case null:
    case undefined: {
      return BASIC_SELECTABLE_AI_MODELS;
    }
  }
}

export function isAiModel(value: unknown): value is AiModel {
  return typeof value === "string" && AI_MODELS.has(value as AiModel);
}

export function isSelectableAiModel(
  value: unknown,
): value is SelectableAiModel {
  return (
    typeof value === "string" &&
    SELECTABLE_AI_MODELS.has(value as SelectableAiModel)
  );
}

export function resolveSelectableAiModel(value: string | null | undefined) {
  return isSelectableAiModel(value) ? value : DEFAULT_SELECTABLE_AI_MODEL;
}

export function isSelectableAiModelForAccountLevel(
  value: unknown,
  accountLevel?: AccountLevel | null,
): value is SelectableAiModel {
  return (
    isSelectableAiModel(value) &&
    getSelectableAiModelSetForAccountLevel(accountLevel).has(value)
  );
}

export function resolveSelectableAiModelForAccountLevel(
  value: string | null | undefined,
  accountLevel?: AccountLevel | null,
) {
  return isSelectableAiModelForAccountLevel(value, accountLevel)
    ? value
    : DEFAULT_SELECTABLE_AI_MODEL;
}

export function getSelectableAiModelOptionsForAccountLevel(
  accountLevel?: AccountLevel | null,
): readonly AiModelOption[] {
  const selectableModels = getSelectableAiModelSetForAccountLevel(accountLevel);
  return SELECTABLE_AI_MODEL_OPTIONS.filter((option) =>
    selectableModels.has(option.value),
  );
}

export function canSelectAiModelForAccountLevel(
  accountLevel?: AccountLevel | null,
) {
  return getSelectableAiModelOptionsForAccountLevel(accountLevel).length > 1;
}

export function getSelectableAiModelOption(
  model: SelectableAiModel,
): AiModelOption {
  return (
    SELECTABLE_AI_MODEL_OPTIONS.find((option) => option.value === model) ??
    SELECTABLE_AI_MODEL_OPTIONS[0]
  );
}
