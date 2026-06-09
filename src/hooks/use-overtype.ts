import OverType from "overtype";
import type { OverTypeInstance, Theme } from "overtype";
import { useEffect, useRef } from "react";
import { ta } from "zod/v4/locales";

interface UseOverTypeOptions {
  value?: string;
  placeholder?: string;
  theme?: "solar" | "cave" | Theme;
  toolbar?: boolean;
  autoResize?: boolean;
  minHeight?: string;
  maxHeight?: string;
  onChange?: (value: string) => void;
  onPaste?: (event: ClipboardEvent) => void;
}

export function useOverType({ ...options }: UseOverTypeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<OverTypeInstance | null>(null);

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    const [instance] = new OverType(containerRef.current, {
      value: options.value ?? "",
      placeholder: options.placeholder,
      theme: options.theme ?? "solar",
      toolbar: options.toolbar ?? false,
      onChange: options.onChange,
      minHeight: options.minHeight,
      maxHeight: options.maxHeight,
      autoResize: options.autoResize,
    });

    editorRef.current = instance;

    const textarea = instance.textarea;

    if (options.onPaste !== undefined) {
      textarea.addEventListener("paste", options.onPaste);
    }
    return () => {
      if (options.onPaste !== undefined) {
        textarea.removeEventListener("paste", options.onPaste);
      }
      instance.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { containerRef, editorRef };
}
