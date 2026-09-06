"use client";

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ModelOption {
  id: string;
  name: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface ModelSelectProps {
  models: ModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: "default" | "sm";
  disabled?: boolean;
  contentClassName?: string;
  className?: string;
  ariaLabel?: string;
}

export function ModelSelect({
  value,
  onValueChange,
  models,
  size,
  disabled,
  contentClassName,
  className,
  ariaLabel = "Wybierz model AI",
}: ModelSelectProps) {
  const selectedModel = models.find((model) => model.id === value);

  return (
    <Select
      items={models.map((model) => ({
        label: model.name,
        value: model.id,
        disabled: model.disabled,
      }))}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        size={size}
        className={className}
        title={selectedModel?.name}
      >
        {selectedModel?.icon === undefined ? null : (
          <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
            {selectedModel.icon}
          </span>
        )}
        <span className="truncate font-medium">
          {selectedModel?.name ?? value}
        </span>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger
        className={cn("min-w-56", contentClassName)}
      >
        <SelectGroup>
          {models.map((model) => (
            <SelectItem
              key={model.id}
              value={model.id}
              disabled={model.disabled}
              className="py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                {model.icon === undefined ? null : (
                  <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                    {model.icon}
                  </span>
                )}
                <span className="truncate font-medium">{model.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
