"use client";

import { useId } from "react";
import type { ClipboardEvent } from "react";

import { cn } from "@/lib/utils";

import {
  MarkdownField,
  MarkdownToolbar,
  MarkdownToolbarProvider,
} from "./markdown-field";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  onBlur?: () => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

/** A bordered Markdown field with its own formatting toolbar. */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  label,
  id,
  onBlur,
  onPaste,
  onKeyDown,
  minHeight = "72px",
  maxHeight = "320px",
  className,
  invalid = false,
  describedBy,
  disabled = false,
}: MarkdownEditorProps) {
  const generatedId = useId();
  const fieldLabel = label ?? placeholder ?? "Treść Markdown";
  return (
    <MarkdownToolbarProvider>
      <div
        className={cn(
          "border-input focus-within:border-ring focus-within:ring-ring/50 has-data-held:border-ring has-data-held:ring-ring/50 dark:bg-input/30 min-w-0 rounded-lg border bg-transparent transition-[color,box-shadow] focus-within:ring-3 has-data-held:ring-3",
          invalid && "border-destructive",
          disabled && "opacity-50",
          className,
        )}
        data-slot="markdown-editor"
      >
        <MarkdownToolbar
          label={`Formatowanie: ${fieldLabel}`}
          disabled={disabled}
          className="border-border border-b p-1"
        />
        <MarkdownField
          id={id ?? generatedId}
          label={fieldLabel}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onPaste={onPaste}
          onKeyDown={(event) => {
            onKeyDown?.(event.nativeEvent);
          }}
          invalid={invalid}
          describedBy={describedBy}
          disabled={disabled}
          minHeight={minHeight}
          maxHeight={maxHeight}
          inputClassName="px-3 py-2.5 text-base leading-relaxed sm:text-sm"
        />
      </div>
    </MarkdownToolbarProvider>
  );
}
