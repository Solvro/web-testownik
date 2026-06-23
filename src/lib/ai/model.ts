import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import "server-only";

import { env } from "@/env";
import { ACCOUNT_LEVEL } from "@/types/user";
import type { AccountLevel } from "@/types/user";

import {
  AI_MODEL,
  DEFAULT_AI_MODEL,
  DEFAULT_SELECTABLE_AI_MODEL,
  isSelectableAiModel,
} from "./models";
import type { AiModel } from "./models";

interface ResolveChatModelOptions {
  accountLevel?: AccountLevel | null;
  requestedModel?: string | null;
}

export function resolveAiModelPreference({
  accountLevel,
  requestedModel,
}: ResolveChatModelOptions): AiModel {
  if (accountLevel !== ACCOUNT_LEVEL.GOLD) {
    return DEFAULT_AI_MODEL;
  }

  return isSelectableAiModel(requestedModel)
    ? requestedModel
    : DEFAULT_SELECTABLE_AI_MODEL;
}

function assertProviderConfigured(model: AiModel) {
  switch (model) {
    case AI_MODEL.GPT_54:
    case AI_MODEL.GPT_54_MINI:
    case AI_MODEL.GPT_55: {
      if (env.OPENAI_API_KEY === undefined) {
        throw new Error("OpenAI is not configured");
      }
      break;
    }
    case AI_MODEL.GROK_43: {
      if (env.XAI_API_KEY === undefined) {
        throw new Error("xAI is not configured");
      }
      break;
    }
    case AI_MODEL.CLAUDE_FABLE_5:
    case AI_MODEL.CLAUDE_OPUS_4_8:
    case AI_MODEL.CLAUDE_SONNET_4_6:
    case AI_MODEL.CLAUDE_HAIKU_4_5: {
      if (env.ANTHROPIC_API_KEY === undefined) {
        throw new Error("Anthropic is not configured");
      }
      break;
    }
  }
}

export function getChatModelForUser(
  options: ResolveChatModelOptions,
): LanguageModel {
  const selectedModel = resolveAiModelPreference(options);

  assertProviderConfigured(selectedModel);

  switch (selectedModel) {
    case AI_MODEL.GPT_54:
    case AI_MODEL.GPT_54_MINI:
    case AI_MODEL.GPT_55: {
      return openai(selectedModel);
    }
    case AI_MODEL.GROK_43: {
      return xai(selectedModel);
    }
    case AI_MODEL.CLAUDE_FABLE_5:
    case AI_MODEL.CLAUDE_OPUS_4_8:
    case AI_MODEL.CLAUDE_SONNET_4_6:
    case AI_MODEL.CLAUDE_HAIKU_4_5: {
      return anthropic(selectedModel);
    }
  }
}
