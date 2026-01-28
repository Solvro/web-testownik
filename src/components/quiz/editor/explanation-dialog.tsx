"use client";

import { FileTextIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

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
  const [localValue, setLocalValue] = useState(value);

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
        <div className="space-y-4">
          <Textarea
            placeholder="Podaj wyjaśnienie, które wyświetli się po udzieleniu odpowiedzi..."
            value={localValue}
            onChange={(event) => {
              setLocalValue(event.target.value);
            }}
            className="min-h-38"
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
      size="icon"
      className="size-8"
      onClick={onClick}
      aria-label={hasExplanation ? "Edytuj wyjaśnienie" : "Dodaj wyjaśnienie"}
    >
      <FileTextIcon className="size-4" />
    </Button>
  );
}
