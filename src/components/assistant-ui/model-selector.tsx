"use client";

import { useAui } from "@assistant-ui/react";
import { memo, useEffect, useState } from "react";
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

export interface ModelSelectorProps {
  models: ModelOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  size?: "default" | "sm";
  disabled?: boolean;
  contentClassName?: string;
  className?: string;
}

function ModelSelectorImplementation({
  value: controlledValue,
  onValueChange: controlledOnValueChange,
  defaultValue,
  models,
  size,
  disabled,
  contentClassName,
  className,
}: ModelSelectorProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(
    () => defaultValue ?? models.at(0)?.id ?? "",
  );
  const value = isControlled ? controlledValue : internalValue;
  const onValueChange = controlledOnValueChange ?? setInternalValue;
  const api = useAui();
  const selectedModel = models.find((model) => model.id === value);
  const handleValueChange = (nextValue: string | null) => {
    if (nextValue !== null) {
      onValueChange(nextValue);
    }
  };

  useEffect(() => {
    const config = { config: { modelName: value } };

    return api.modelContext().register({
      getModelContext: () => config,
    });
  }, [api, value]);

  return (
    <Select
      items={models.map((model) => ({
        label: model.name,
        value: model.id,
        disabled: model.disabled,
      }))}
      value={value}
      onValueChange={handleValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label="Wybierz model AI"
        size={size}
        className={cn("aui-model-selector-trigger", className)}
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

const ModelSelector = memo(ModelSelectorImplementation);

ModelSelector.displayName = "ModelSelector";

export { ModelSelector };
