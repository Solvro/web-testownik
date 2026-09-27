"use client";

// eslint-disable-next-line import/no-named-as-default
import OverType from "overtype";
import type { Options, OverTypeInstance, Theme } from "overtype";
import { useEffect, useRef } from "react";

interface UseOverTypeOptions {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  placeholder?: string;
  theme?: Theme;
  minHeight?: string;
  maxHeight?: string;
  autoResize?: boolean;
}

// Run once per OverType render, without observing or reinserting our own changes.
function highlightMath(preview: HTMLElement) {
  const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode() !== null) {
    const node = walker.currentNode as Text;
    if (
      node.data.includes("$") &&
      node.parentElement?.closest("code, pre, .code-block, .inline-code") ==
        null
    ) {
      nodes.push(node);
    }
  }
  for (const node of nodes) {
    const matches = [...node.data.matchAll(/\$\$[^$]+\$\$|\$[^$\n]+\$/g)];
    if (matches.length === 0) {
      continue;
    }
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of matches) {
      fragment.append(node.data.slice(offset, match.index));
      const span = document.createElement("span");
      span.className = "ot-math";
      span.textContent = match[0];
      fragment.append(span);
      offset = match.index + match[0].length;
    }
    fragment.append(node.data.slice(offset));
    node.replaceWith(fragment);
  }
}

export function useOverType(options: UseOverTypeOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<OverTypeInstance | null>(null);
  const onChangeRef = useRef(options.onChange);
  const onKeyDownRef = useRef(options.onKeyDown);
  const syncingFromPropsRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = options.onChange;
    onKeyDownRef.current = options.onKeyDown;
  }, [options.onChange, options.onKeyDown]);

  useEffect(() => {
    if (containerRef.current === null) {
      return;
    }
    // OverType 2.4 supports onRender, but omits it from its Options declaration.
    const editorOptions: Options & {
      onRender: (preview: HTMLElement) => void;
    } = {
      value: options.value,
      placeholder: options.placeholder,
      theme: options.theme,
      toolbar: false,
      minHeight: options.minHeight ?? "40px",
      maxHeight: options.maxHeight,
      autoResize: options.autoResize ?? true,
      padding: "8px 10px",
      lineHeight: 1.5,
      mobile: { fontSize: "16px", padding: "8px 10px", lineHeight: 1.5 },
      textareaProps: {
        rows: 1,
        "aria-label": options.placeholder ?? "Treść Markdown",
      },
      onRender: highlightMath,
      onKeydown: (event) => {
        onKeyDownRef.current?.(event);
      },
      onChange: (nextValue) => {
        // Ignore constructor notifications and controlled prop synchronization.
        if (editorRef.current !== null && !syncingFromPropsRef.current) {
          onChangeRef.current(nextValue);
        }
      },
    };
    const [instance] = new OverType(containerRef.current, editorOptions);
    // The library imposes a 60px CSS minimum even when minHeight is smaller.
    instance.wrapper.style.setProperty(
      "min-height",
      options.minHeight ?? "40px",
      "important",
    );
    editorRef.current = instance;
    return () => {
      editorRef.current = null;
      instance.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Create one editor per mounted field; synchronize mutable props below.

  useEffect(() => {
    const instance = editorRef.current;
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- Synchronize the controlled value with the external editor, without emitting a user change.
    if (instance === null || instance.getValue() === options.value) {
      return;
    }
    syncingFromPropsRef.current = true;
    try {
      instance.setValue(options.value);
    } finally {
      syncingFromPropsRef.current = false;
    }
  }, [options.value]);

  useEffect(() => {
    const instance = editorRef.current;
    if (instance !== null) {
      instance.options.placeholder = options.placeholder ?? "";
      instance.textarea.placeholder = options.placeholder ?? "";
      instance.textarea.setAttribute(
        "aria-label",
        options.placeholder ?? "Treść Markdown",
      );
      const placeholder = instance.wrapper.querySelector(
        ".overtype-placeholder",
      );
      if (placeholder !== null) {
        placeholder.textContent = options.placeholder ?? "";
      }
    }
  }, [options.placeholder]);

  return { containerRef, editorRef };
}
