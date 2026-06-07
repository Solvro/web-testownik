import type { Theme } from "overtype";

import { useOverType } from "@/hooks/use-overtype";

interface OverTypeEditorProps {
  value?: string;
  placeholder?: string;
  theme?: "solar" | "cave" | Theme;
  toolbar?: boolean;
  onChange?: (value: string) => void;
  onPaste?: (event: ClipboardEvent) => void;
  className?: string;
}

function OverTypeEditor({
  value,
  placeholder,
  toolbar,
  theme,
  onChange,
  onPaste,
  className,
}: OverTypeEditorProps) {
  const { containerRef } = useOverType({
    value,
    placeholder,
    theme,
    toolbar,
    onChange,
    onPaste,
  });
  return <div className={className} ref={containerRef} />;
}

export { OverTypeEditor };
