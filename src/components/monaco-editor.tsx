import type { Monaco } from "@monaco-editor/react";
import { Editor } from "@monaco-editor/react";
import { editor } from "monaco-editor";
import { useTheme } from "next-themes";
import { useState } from "react";

import IStandaloneCodeEditor = editor.IStandaloneCodeEditor;

interface MonacoEditorProps {
  setLegacyContent: (value: string) => void;
  defaultValue: string;
  onMount: (editor: IStandaloneCodeEditor) => void;
}

export function MonacoEditor({
  setLegacyContent,
  defaultValue,
  onMount,
}: MonacoEditorProps) {
  const { theme } = useTheme();
  const systemTheme =
    typeof window === "undefined"
      ? "light"
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  const activeTheme = theme === "system" ? systemTheme : theme;

  const [height, setHeight] = useState(200);

  const handleEditorMount = (monacoEditor: IStandaloneCodeEditor) => {
    const updateHeight = () => {
      const contentHeight = monacoEditor.getContentHeight();
      const lineHeight = 21;

      const minHeight = lineHeight * 10;
      const maxHeight = lineHeight * 20;

      const newHeight = Math.min(maxHeight, Math.max(minHeight, contentHeight));

      setHeight(newHeight);
      monacoEditor.layout();
    };

    monacoEditor.onDidContentSizeChange(updateHeight);
    updateHeight();
  };

  return (
    <div
      style={{ height }}
      className="dark:border-ring overflow-hidden rounded-md border"
    >
      <Editor
        beforeMount={(monaco: Monaco) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
          monaco.editor.defineTheme("testownik-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [],
            colors: {
              "editor.background": "#1c263a",
              "editorCursor.foreground": "#ffffff",
              "editor.lineHighlightBackground": "#283e66",
              "editor.selectionBackground": "#3e4451",
            },
          });
        }}
        theme={`testownik-${activeTheme ?? "dark"}`}
        height="100%"
        defaultLanguage="json"
        defaultValue={defaultValue}
        onMount={(monacoEditor: IStandaloneCodeEditor) => {
          onMount(monacoEditor);
          handleEditorMount(monacoEditor);
        }}
        onChange={(value) => {
          setLegacyContent(value ?? "");
        }}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          wrappingStrategy: "advanced",
          scrollbar: {
            vertical: "visible",
            horizontal: "visible",
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
          },
        }}
      />
    </div>
  );
}
