import { Anthropic, OpenAI } from "@lobehub/icons";

import type { AiModelProvider } from "@/lib/ai/models";

interface AiModelProviderIconProps {
  className?: string;
  provider: AiModelProvider;
}

export function AiModelProviderIcon({
  className,
  provider,
}: AiModelProviderIconProps) {
  return provider === "Anthropic" ? (
    <Anthropic aria-hidden="true" className={className} />
  ) : (
    <OpenAI aria-hidden="true" className={className} />
  );
}
