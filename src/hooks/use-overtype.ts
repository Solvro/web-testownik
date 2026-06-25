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
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function useOverType({ ...options }: UseOverTypeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<OverTypeInstance | null>(null);

  const syncingFromPropsRef = useRef(false);
  const onChangeRef = useRef(options.onChange);
  const onPasteRef = useRef(options.onPaste);
  const onKeyDownRef = useRef(options.onKeyDown);

  useEffect(() => {
    onChangeRef.current = options.onChange;
    onPasteRef.current = options.onPaste;
    onKeyDownRef.current = options.onKeyDown;
  }, [options.onChange, options.onPaste, options.onKeyDown]);

  useEffect(() => {
    const instance = editorRef.current;
    if (instance === null) {
      return;
    }

    const nextValue = options.value ?? "";
    const currentValue = instance.getValue();
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler
    if (currentValue === nextValue) {
      return;
    }

    syncingFromPropsRef.current = true;
    instance.setValue(nextValue);
    syncingFromPropsRef.current = false;
  }, [options.value]);

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }

    const [instance] = new OverType(containerRef.current, {
      value: options.value ?? "",
      placeholder: options.placeholder,
      theme: options.theme ?? "solar",
      toolbar: options.toolbar ?? false,
      minHeight: options.minHeight,
      maxHeight: options.maxHeight,
      autoResize: options.autoResize,
    });

    editorRef.current = instance;

    const handleInput = (event: Event) => {
      if (syncingFromPropsRef.current) {
        return;
      }
      const target = event.target as HTMLTextAreaElement | null;
      if (target === null) {
        return;
      }
      onChangeRef.current?.({
        target,
        currentTarget: target,
      } as React.ChangeEvent<HTMLTextAreaElement>);
    };

    const handlePaste = (event: Event) => {
      onPasteRef.current?.(event as unknown as React.ClipboardEvent);
    };

    const handleKeyDown = (event: Event) => {
      onKeyDownRef.current?.(
        event as unknown as React.KeyboardEvent<HTMLTextAreaElement>,
      );
    };

    const textarea = instance.textarea;
    textarea.addEventListener("input", handleInput);
    textarea.addEventListener("paste", handlePaste);
    textarea.addEventListener("keydown", handleKeyDown);

    return () => {
      textarea.removeEventListener("input", handleInput);
      textarea.removeEventListener("paste", handlePaste);
      textarea.removeEventListener("keydown", handleKeyDown);
      instance.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { containerRef, editorRef };
}
