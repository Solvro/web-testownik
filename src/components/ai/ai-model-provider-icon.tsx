import type { ComponentType } from "react";
import { SiAnthropic, SiOpenai } from "react-icons/si";

import type { AiModelProvider } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

interface AiModelProviderIconProps {
  className?: string;
  provider: AiModelProvider;
}

const AI_MODEL_PROVIDER_ICON_CONFIG = {
  Anthropic: {
    Icon: SiAnthropic,
    className: "text-[#D97757]",
  },
  OpenAI: {
    Icon: SiOpenai,
    className: "text-foreground",
  },
} as const satisfies Record<
  AiModelProvider,
  {
    Icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
    className: string;
  }
>;

export function AiModelProviderIcon({
  className,
  provider,
}: AiModelProviderIconProps) {
  const { Icon, className: providerClassName } =
    AI_MODEL_PROVIDER_ICON_CONFIG[provider];

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4", providerClassName, className)}
    />
  );
}
