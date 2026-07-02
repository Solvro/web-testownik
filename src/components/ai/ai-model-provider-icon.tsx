import { Anthropic, Grok, OpenAI } from "@lobehub/icons";

import type { AiModelProvider } from "@/lib/ai/models";

interface AiModelProviderIconProps {
  className?: string;
  provider: AiModelProvider;
}

export function AiModelProviderIcon({
  className,
  provider,
}: AiModelProviderIconProps) {
  switch (provider) {
    case "Anthropic": {
      return <Anthropic aria-hidden="true" className={className} />;
    }
    case "xAI": {
      return <Grok aria-hidden="true" className={className} />;
    }
    case "OpenAI": {
      return <OpenAI aria-hidden="true" className={className} />;
    }
  }
}
