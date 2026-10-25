"use client";

import { FileTextIcon } from "lucide-react";
import { useState } from "react";

import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExplanationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
}

export function ExplanationDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: ExplanationDialogProps) {
  const [localValue, setLocalValue] = useState(() => {
    if (open) {
      return value;
    }
    return value;
  });

  function handleSave() {
    onChange(localValue);
    onOpenChange(false);
  }

  function handleClear() {
    setLocalValue("");
    onChange("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Wyjaśnienie pytania</DialogTitle>
        </DialogHeader>
        <div className="w-full min-w-0 space-y-4">
          <MarkdownEditor
            label="Wyjaśnienie pytania"
            placeholder="Podaj wyjaśnienie, które wyświetli się po udzieleniu odpowiedzi..."
            value={localValue}
            onChange={setLocalValue}
            minHeight="152px"
            maxHeight="384px"
          />
          <div className="flex justify-end gap-2">
            {localValue.trim() !== "" && (
              <Button type="button" variant="outline" onClick={handleClear}>
                Usuń wyjaśnienie
              </Button>
            )}
            <Button type="button" onClick={handleSave}>
              Zapisz
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ExplanationButtonProps {
  hasExplanation: boolean;
  onClick: () => void;
}

export function ExplanationButton({
  hasExplanation,
  onClick,
}: ExplanationButtonProps) {
  return (
    <Button
      type="button"
      variant={hasExplanation ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={onClick}
      aria-label={hasExplanation ? "Edytuj wyjaśnienie" : "Dodaj wyjaśnienie"}
    >
      <FileTextIcon className="size-4" />
    </Button>
  );
}
