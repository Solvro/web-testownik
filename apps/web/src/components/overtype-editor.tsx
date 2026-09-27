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
import { useId, useRef, useState } from "react";
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
    strong: "var(--chart-4)",
    em: "var(--chart-3)",
    h1: "var(--chart-4)",
    h2: "var(--chart-3)",
    h3: "var(--chart-2)",
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
  ownerId,
  linkOnly = false,
}: {
  editorRef: RefObject<OverTypeInstance | null>;
  fieldLabel: string;
  ownerId: string;
  linkOnly?: boolean;
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
            aria-label={
              linkOnly ? `Link: ${fieldLabel}` : `Formatowanie: ${fieldLabel}`
            }
            title="Formatowanie tekstu"
          >
            {linkOnly ? (
              <LinkIcon className="size-4" />
            ) : (
              <ALargeSmallIcon className="size-4" />
            )}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        data-editor-owner={ownerId}
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
        {(linkOnly ? [] : formatGroups).map((group) => (
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
  const [editing, setEditing] = useState(false);
  const previewRef = useRef<HTMLButtonElement>(null);
  const ownerId = useId();
  const showPreview = !editing && value.trim() !== "";

  function startEditing() {
    setEditing(true);
    requestAnimationFrame(() => {
      const textarea = editorRef.current?.textarea;
      if (textarea !== undefined) {
        textarea.focus();
        textarea.setSelectionRange(
          textarea.value.length,
          textarea.value.length,
        );
        // Recalculate the editor height after revealing its mounted container.
        editorRef.current?.setValue(textarea.value);
      }
    });
  }

  function apply(action: FormatAction["apply"]) {
    const textarea = editorRef.current?.textarea;
    if (textarea !== undefined) {
      action(textarea);
      textarea.focus();
    }
  }

  return (
    <div
      className={cn(
        "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] focus-within:ring-3",
        className,
      )}
      onBlur={(event) => {
        const next = event.relatedTarget;
        // Formatting popovers belong to this editor even though they use a portal.
        if (
          next instanceof Element &&
          (event.currentTarget.contains(next) ||
            next.closest<HTMLElement>("[data-editor-owner]")?.dataset
              .editorOwner === ownerId)
        ) {
          return;
        }
        setEditing(false);
      }}
    >
      {editing ? (
        <div className="border-border flex items-center gap-1 border-b px-2 py-1">
          <div className="hidden flex-wrap items-center gap-1 lg:flex">
            {formatGroups.map((group) => (
              <div key={group.label} className="flex items-center gap-0.5">
                {group.actions.map(({ label, icon: Icon, apply: action }) => (
                  <Button
                    key={label}
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      apply(action);
                    }}
                  >
                    <Icon className="size-4" />
                  </Button>
                ))}
              </div>
            ))}
            <FormattingPopover
              editorRef={editorRef}
              fieldLabel={fieldLabel}
              ownerId={ownerId}
              linkOnly
            />
          </div>
          <div className="lg:hidden">
            <FormattingPopover
              editorRef={editorRef}
              fieldLabel={fieldLabel}
              ownerId={ownerId}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => {
              setEditing(false);
              requestAnimationFrame(() => {
                previewRef.current?.focus();
              });
            }}
          >
            <EyeIcon className="size-4" />
            Podgląd
          </Button>
        </div>
      ) : null}
      <div
        hidden={showPreview}
        onPaste={onPaste}
        onFocus={() => {
          setEditing(true);
        }}
      >
        <div
          ref={containerRef}
          data-slot="overtype-editor"
          className="[&_.ot-math]:text-primary relative isolate z-0"
        />
      </div>
      {showPreview ? (
        <div className="relative cursor-text px-4 py-2">
          <MarkdownRenderer>{value}</MarkdownRenderer>
          <button
            ref={previewRef}
            type="button"
            aria-label={`Edytuj: ${fieldLabel}`}
            className="absolute inset-0 cursor-text rounded-md outline-none"
            onClick={startEditing}
          />
        </div>
      ) : null}
    </div>
  );
}
