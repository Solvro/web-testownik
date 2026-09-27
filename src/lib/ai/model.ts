import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import "server-only";

import { env } from "@/env";
import type { AiModelProvider } from "@/lib/ai/models";

const PROVIDERS: Record<
  AiModelProvider,
  {
    configured: () => boolean;
    create: (model: string) => LanguageModel;
  }
> = {
  openai: {
    configured: () => env.OPENAI_API_KEY !== undefined,
    create: (model) => openai(model),
  },
  xai: {
    configured: () => env.XAI_API_KEY !== undefined,
    create: (model) => xai(model),
  },
  anthropic: {
    configured: () => env.ANTHROPIC_API_KEY !== undefined,
    create: (model) => anthropic(model),
  },
};

function isAiModelProvider(value: string): value is AiModelProvider {
  return value in PROVIDERS;
}

export function isAiProviderConfigured(provider: AiModelProvider) {
  return PROVIDERS[provider].configured();
}

export function getConfiguredAiModel(
  model: string,
  provider: string,
): LanguageModel {
  if (!isAiModelProvider(provider)) {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }
  const adapter = PROVIDERS[provider];
  if (!adapter.configured()) {
    throw new Error(`${provider} is not configured`);
  }
  return adapter.create(model);
}
