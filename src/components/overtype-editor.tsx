"use client";

import {
  ALargeSmallIcon,
  BoldIcon,
  CodeIcon,
  CodeXmlIcon,
  EyeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PiIcon,
  QuoteIcon,
  SigmaIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OverTypeInstance, Theme } from "overtype";
import { markdownActions } from "overtype";
import { useId, useState } from "react";
import type { ClipboardEvent, RefObject } from "react";

import { useOverType } from "@/hooks/use-overtype";
import { cn } from "@/lib/utils";

import { MarkdownRenderer } from "./markdown-renderer";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";

const theme: Theme = {
  name: "default",
  colors: {
    bgPrimary: "transparent",
    bgSecondary: "transparent",
    text: "var(--foreground)",
    placeholder: "var(--muted-foreground)",
    syntaxMarker: "var(--muted-foreground)",
    cursor: "var(--primary)",
    selection: "color-mix(in srgb, var(--primary) 20%, transparent)",
    strong: "var(--foreground)",
    em: "var(--foreground)",
    h1: "var(--foreground)",
    h2: "var(--foreground)",
    h3: "var(--foreground)",
    blockquote: "var(--muted-foreground)",
    codeBg: "var(--muted)",
    code: "var(--foreground)",
  },
};

interface OverTypeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onPaste?: (event: ClipboardEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  minHeight?: string;
  maxHeight?: string;
  autoResize?: boolean;
  className?: string;
}

interface FormatAction {
  label: string;
  icon: LucideIcon;
  apply: (textarea: HTMLTextAreaElement) => void;
}

const formatGroups: { label: string; actions: FormatAction[] }[] = [
  {
    label: "Tekst",
    actions: [
      {
        label: "Pogrubienie",
        icon: BoldIcon,
        apply: (ta) => {
          markdownActions.toggleBold(ta);
        },
      },
      {
        label: "Kursywa",
        icon: ItalicIcon,
        apply: (ta) => {
          markdownActions.toggleItalic(ta);
        },
      },
      {
        label: "Kod w tekście",
        icon: CodeXmlIcon,
        apply: (ta) => {
          markdownActions.toggleCode(ta);
        },
      },
      {
        label: "Blok kodu",
        icon: CodeIcon,
        apply: (ta) => {
          markdownActions.applyCustomFormat(ta, {
            prefix: "\n```\n",
            suffix: "\n```\n",
          });
        },
      },
    ],
  },
  {
    label: "Matematyka",
    actions: [
      {
        label: "Wzór w tekście",
        icon: SigmaIcon,
        apply: (ta) => {
          markdownActions.applyCustomFormat(ta, { prefix: "$", suffix: "$" });
        },
      },
      {
        label: "Blok wzoru",
        icon: PiIcon,
        apply: (ta) => {
          markdownActions.applyCustomFormat(ta, {
            prefix: "\n$$\n",
            suffix: "\n$$\n",
          });
        },
      },
    ],
  },
  {
    label: "Struktura",
    actions: [
      {
        label: "Nagłówek 1",
        icon: Heading1Icon,
        apply: (ta) => {
          markdownActions.toggleH1(ta);
        },
      },
      {
        label: "Nagłówek 2",
        icon: Heading2Icon,
        apply: (ta) => {
          markdownActions.toggleH2(ta);
        },
      },
      {
        label: "Nagłówek 3",
        icon: Heading3Icon,
        apply: (ta) => {
          markdownActions.toggleH3(ta);
        },
      },
      {
        label: "Cytat",
        icon: QuoteIcon,
        apply: (ta) => {
          markdownActions.toggleQuote(ta);
        },
      },
      {
        label: "Lista punktowana",
        icon: ListIcon,
        apply: (ta) => {
          markdownActions.toggleBulletList(ta);
        },
      },
      {
        label: "Lista numerowana",
        icon: ListOrderedIcon,
        apply: (ta) => {
          markdownActions.toggleNumberedList(ta);
        },
      },
    ],
  },
];

function FormattingPopover({
  editorRef,
  fieldLabel,
}: {
  editorRef: RefObject<OverTypeInstance | null>;
  fieldLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const urlId = useId();

  function apply(action: FormatAction["apply"]) {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    action(ta);
    setOpen(false);
    setUrl("");
    setUrlError("");
    // Keep typing at the selection after choosing a format with mouse or keyboard.
    requestAnimationFrame(() => {
      ta.focus();
    });
  }

  function insertLink() {
    const trimmedUrl = url.trim();
    try {
      const parsed = new URL(trimmedUrl);
      if (!["https:", "http:", "mailto:"].includes(parsed.protocol)) {
        throw new Error("Unsupported protocol");
      }
    } catch {
      setUrlError("Podaj poprawny adres https://, http:// lub mailto:.");
      return;
    }
    apply((ta) => {
      markdownActions.insertLink(ta, { url: trimmedUrl });
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setUrl("");
          setUrlError("");
        }
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Formatowanie: ${fieldLabel}`}
            title="Formatowanie tekstu"
          >
            <ALargeSmallIcon className="size-4" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        className="max-h-(--available-height) w-80 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto"
        finalFocus={(closeType) =>
          closeType === "keyboard" ? editorRef.current?.textarea : false
        }
      >
        <PopoverHeader>
          <PopoverTitle>Formatowanie tekstu</PopoverTitle>
          <PopoverDescription>
            Zaznacz tekst, aby zmienić jego format.
          </PopoverDescription>
        </PopoverHeader>
        {formatGroups.map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {group.actions.map(({ label, icon: Icon, apply: action }) => (
                <Button
                  key={label}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 justify-start"
                  onClick={() => {
                    apply(action);
                  }}
                >
                  <Icon className="size-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        ))}
        <div className="border-border space-y-2 border-t pt-3">
          <Label htmlFor={urlId}>Link</Label>
          <div className="flex gap-2">
            <Input
              id={urlId}
              type="url"
              value={url}
              placeholder="https://example.com"
              aria-invalid={urlError !== ""}
              aria-describedby={urlError === "" ? undefined : `${urlId}-error`}
              onChange={(event) => {
                setUrl(event.target.value);
                setUrlError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  insertLink();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Wstaw link"
              disabled={url.trim() === ""}
              onClick={insertLink}
            >
              <LinkIcon className="size-4" />
            </Button>
          </div>
          {urlError === "" ? null : (
            <p
              id={`${urlId}-error`}
              role="alert"
              className="text-destructive text-xs"
            >
              {urlError}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function OverTypeEditor({
  value,
  placeholder,
  onChange,
  onPaste,
  onKeyDown,
  minHeight,
  maxHeight,
  autoResize,
  className,
}: OverTypeEditorProps) {
  const { containerRef, editorRef } = useOverType({
    value,
    placeholder,
    onChange,
    theme,
    minHeight,
    maxHeight,
    autoResize,
    onKeyDown,
  });
  const fieldLabel = placeholder ?? "Treść Markdown";

  return (
    <div
      className={cn(
        "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1" onPaste={onPaste}>
        <div
          ref={containerRef}
          data-slot="overtype-editor"
          className="[&_.ot-math]:text-primary relative isolate z-0"
        />
      </div>
      <div className="text-muted-foreground flex shrink-0 items-start gap-0.5 p-1">
        <FormattingPopover editorRef={editorRef} fieldLabel={fieldLabel} />
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Podgląd: ${fieldLabel}`}
                title="Podgląd Markdown"
              >
                <EyeIcon className="size-4" />
              </Button>
            }
          />
          <PopoverContent
            align="end"
            className="max-h-(--available-height) w-96 max-w-[calc(100vw-2rem)] overflow-y-auto"
            initialFocus={false}
          >
            <PopoverHeader>
              <PopoverTitle>Podgląd</PopoverTitle>
            </PopoverHeader>
            {value.trim() === "" ? (
              <p className="text-muted-foreground text-sm">
                Zacznij pisać, aby zobaczyć podgląd.
              </p>
            ) : (
              <MarkdownRenderer>{value}</MarkdownRenderer>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
