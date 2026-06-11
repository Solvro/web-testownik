// eslint-disable-next-line import/no-named-as-default
import OverType from "overtype";
import type { OverTypeInstance, Theme } from "overtype";
import { useEffect, useRef } from "react";

interface UseOverTypeOptions {
  value?: string;
  placeholder?: string;
  theme?: "solar" | "cave" | Theme;
  toolbar?: boolean;
  autoResize?: boolean;
  minHeight?: string;
  maxHeight?: string;
  onChange?: (value: string) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
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
      textarea.addEventListener(
        "paste",
        options.onPaste as unknown as EventListener,
      );
    }
    if (options.onKeyDown !== undefined) {
      textarea.addEventListener(
        "keydown",
        options.onKeyDown as unknown as EventListener,
      );
    }
    return () => {
      if (options.onPaste !== undefined) {
        textarea.removeEventListener(
          "paste",
          options.onPaste as unknown as EventListener,
        );
      }
      instance.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { containerRef, editorRef };
}
