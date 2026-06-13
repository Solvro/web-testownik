import {
  ALargeSmallIcon,
  BoldIcon,
  CheckIcon,
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
  SquarePenIcon,
} from "lucide-react";
import type { OverTypeInstance, Theme } from "overtype";
import { markdownActions } from "overtype";
import React, { useEffect, useState } from "react";

import { useOverType } from "@/hooks/use-overtype";
import { cn } from "@/lib/utils";

import { MarkdownRenderer } from "./markdown-renderer";
import { Button } from "./ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "./ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

//#region Themes
const theme: Theme = {
  name: "default",
  colors: {
    bgSecondary: "transparent",
    text: "var(--foreground)",
    syntaxMarker: "color-mix(in srgb, var(--foreground) 50%, transparent)",
    cursor: "var(--app-primary)",
    selection: "color-mix(in srgb, var(--app-primary) 20%, transparent)",
    strong: "var(--chart-4)",
    em: "var(--chart-3)",
    h1: "var(--chart-4)",
    h2: "var(--chart-3)",
    h3: "var(--chart-2)",
    blockquote: "color-mix(in srgb, var(--foreground) 70%, transparent)",
    codeBg: "color-mix(in srgb, var(--chart-6) 50%, transparent)",
    code: "var(--)",
  },
};
//#endregion

interface OverTypeEditorProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  minHeight?: string;
  maxHeight?: string;
  autoResize?: boolean;
  className?: string;
}

//#region Custom format detection

const isInCodeBlock = (ta: HTMLTextAreaElement): boolean => {
  const value_ = ta.value;
  const cursor = ta.selectionStart;

  const before = value_.slice(0, cursor);
  const fencesBefore = (before.match(/^```/gm) ?? []).length;

  return fencesBefore % 2 !== 0;
};

const isInMathBlock = (ta: HTMLTextAreaElement): boolean => {
  const value_ = ta.value;
  const cursor = ta.selectionStart;

  const before = value_.slice(0, cursor);
  const fencesBefore = (before.match(/^\$\$/gm) ?? []).length;

  return fencesBefore % 2 !== 0;
};

const isInInlineMath = (ta: HTMLTextAreaElement): boolean => {
  const { selectionStart, selectionEnd, value } = ta;
  const lookBehind = Math.max(0, selectionStart - 10);
  const lookAhead = Math.min(value.length, selectionEnd + 10);
  const surrounding = value.slice(lookBehind, lookAhead);
  if (surrounding.includes("$")) {
    const beforeCursor = value.slice(
      Math.max(0, selectionStart - 100),
      selectionStart,
    );
    const afterCursor = value.slice(
      selectionEnd,
      Math.min(value.length, selectionEnd + 100),
    );
    const lastOpenInlineMath = beforeCursor.lastIndexOf("$");
    const nextCloseInlineMath = afterCursor.indexOf("$");
    if (lastOpenInlineMath !== -1 && nextCloseInlineMath !== -1) {
      return true;
    }
  }
  return false;
};

//#endregion

function OverTypeEditor({
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
    theme,
    toolbar: false,
    onChange,
    onPaste,
    onKeyDown,
    autoResize,
    minHeight,
    maxHeight,
  });

  const [previewOpen, setPreviewOpen] = useState<boolean>(true);

  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }

    const update = () => {
      const formats = markdownActions.getActiveFormats(ta);

      if (isInInlineMath(ta)) {
        formats.push("inlineMath");
      }

      if (isInMathBlock(ta)) {
        formats.splice(formats.indexOf("inlineMath"), 1);
        formats.push("blockMath");
      }

      if (isInCodeBlock(ta)) {
        formats.splice(formats.indexOf("code"), 1);
        formats.push("blockCode");
      }

      setActiveFormats(new Set(formats));
    };

    ta.addEventListener("selectionchange", update);
    ta.addEventListener("keyup", update);
    ta.addEventListener("mouseup", update);

    return () => {
      ta.removeEventListener("selectionchange", update);
      ta.removeEventListener("keyup", update);
      ta.removeEventListener("mouseup", update);
    };
  }, [editorRef, editorRef.current?.textarea]);

  // Custom styling
  useEffect(() => {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }

    const wrapper = ta.closest(".overtype-wrapper");
    if (wrapper === null) {
      return;
    }
    const preview = wrapper.querySelector(".overtype-preview");
    if (preview === null) {
      return;
    }

    const styleId = "#ot-math-styles";
    if (document.querySelector(styleId) === null) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
      .ot-math-inline {
        color: var(--chart-6);
        font-style: italic;
      }
      .ot-math-block {
        color: var(--chart-6);
        font-style: italic;
      }
    `;
      document.head.append(style);
    }

    const processMath = (node: Element) => {
      for (const child of node.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE) {
          return;
        }
        const text = child.textContent ?? "";
        if (!text.includes("$")) {
          return;
        }

        const span = document.createElement("span");
        const pattern = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        //eslint-disable-next-line no-cond-assign
        while ((match = pattern.exec(text)) !== null) {
          if (match.index > lastIndex) {
            span.append(
              document.createTextNode(text.slice(lastIndex, match.index)),
            );
          }
          const token = match[0];
          const mathSpan = document.createElement("span");
          mathSpan.className = token.startsWith("$$")
            ? "ot-math-block"
            : "ot-math-inline";
          mathSpan.textContent = token;
          span.append(mathSpan);
          lastIndex = pattern.lastIndex;
        }
        if (lastIndex < text.length) {
          span.append(document.createTextNode(text.slice(lastIndex)));
        }

        child.replaceWith(span);
      }
    };

    const observer = new MutationObserver(() => {
      for (const div of preview.querySelectorAll("div")) {
        processMath(div);
      }
    });

    observer.observe(preview, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelector(styleId)?.remove();
    };
  }, [editorRef.current?.textarea]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEmpty: boolean = editorRef.current?.getValue() === "";

  return (
    <div
      className={cn(
        className,
        "group border-input placeholder:text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content w-full flex-col rounded-md border bg-transparent text-base shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
      )}
    >
      <Toolbar
        className={cn(
          "mx-2 flex items-center gap-1 overflow-hidden transition-all duration-200 ease-in-out",
          "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          "group-focus-within:pointer-events-auto group-focus-within:my-1 group-focus-within:max-h-16 group-focus-within:translate-y-0 group-focus-within:opacity-100",
        )}
        activeFormats={activeFormats}
        editorRef={editorRef}
        showPreview={(value_: boolean) => {
          setPreviewOpen(value_);
          if (!value_) {
            requestAnimationFrame(() => {
              const ta = editorRef.current?.textarea;
              if (ta === undefined) {
                return;
              }
              ta.dispatchEvent(new Event("input", { bubbles: true }));
            });
          }
        }}
        preview={previewOpen}
      />

      <div className={previewOpen ? "hidden" : "inline-block"}>
        <div
          id="overtype-editor"
          className="flex-1"
          ref={containerRef}
          style={
            {
              "--app-primary": "var(--primary)",
              isolation: "isolate",
              zIndex: 0,
              position: "relative",
            } as React.CSSProperties
          }
        />
      </div>

      {previewOpen ? (
        <MarkdownRenderer
          className={cn(
            "min-h- mx-4 my-2 min-h-[1.5rem]",
            isEmpty ? "text-muted-foreground" : "",
          )}
        >
          {isEmpty
            ? (placeholder ?? "")
            : (editorRef.current?.getValue() ?? "")}
        </MarkdownRenderer>
      ) : null}
    </div>
  );
}

interface ToolbarProps {
  showPreview: (value: boolean) => void;
  preview: boolean;
  activeFormats: Set<string>;
  editorRef: React.RefObject<OverTypeInstance | null>;
  className?: string;
}

function Toolbar({
  activeFormats,
  editorRef,
  showPreview,
  preview,
  className,
}: ToolbarProps) {
  const isActive: (format: string) => boolean = (format: string) =>
    activeFormats.has(format);

  const apply = (action: keyof typeof markdownActions) => {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    if (!preview) {
      (markdownActions[action] as (ta: HTMLTextAreaElement) => void)(ta);
      ta.focus();
    }
  };

  function insertInlineMath() {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    markdownActions.applyCustomFormat(ta, {
      prefix: "$",
      suffix: "$",
    });
    ta.focus();
  }

  function insertBlockMath() {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    markdownActions.applyCustomFormat(ta, {
      prefix: "\n$$\n",
      suffix: "\n$$\n",
    });
    ta.focus();
  }

  function insertBlockCode() {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    markdownActions.applyCustomFormat(ta, {
      prefix: "\n```\n",
      suffix: "\n```\n",
    });
    ta.focus();
  }

  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  return (
    <div className="relative">
      <div
        role="toolbar"
        aria-label="Formatowanie tekstu"
        className={cn(className, "not-lg:hidden")}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("bold") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleBold");
                }}
              >
                <BoldIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>
            Pogrubienie <Kbd>Ctrl + B</Kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("italic") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleItalic");
                }}
              >
                <ItalicIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>
            Pochylenie <Kbd>Ctrl + I</Kbd>
          </TooltipContent>
        </Tooltip>
        <ButtonGroupSeparator />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("code") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleCode");
                }}
              >
                <CodeXmlIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Kod w tekście</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("blockCode") ? "default" : "ghost"}
                onClick={() => {
                  insertBlockCode();
                }}
              >
                <CodeIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Blok kodu</TooltipContent>
        </Tooltip>
        <ButtonGroupSeparator />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("inlineMath") ? "default" : "ghost"}
                onClick={() => {
                  insertInlineMath();
                }}
              >
                <SigmaIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Wzór w tekście</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("blockMath") ? "default" : "ghost"}
                onClick={() => {
                  insertBlockMath();
                }}
              >
                <PiIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Blok wzoru</TooltipContent>
        </Tooltip>
        <ButtonGroupSeparator />
        <LinkButton isActive={isActive} editorRef={editorRef} />
        <ButtonGroupSeparator />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("header") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleH1");
                }}
              >
                <Heading1Icon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Tytuł</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("header-2") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleH2");
                }}
              >
                <Heading2Icon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Podtytuł</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("header-3") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleH3");
                }}
              >
                <Heading3Icon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Sekcja</TooltipContent>
        </Tooltip>
        <ButtonGroupSeparator />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("bullet-list") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleBulletList");
                }}
              >
                <ListIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Lista nieuporządkowana</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("numbered-list") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleNumberedList");
                }}
              >
                <ListOrderedIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Lista uporządkowana</TooltipContent>
        </Tooltip>
        <ButtonGroupSeparator />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="aspect-square p-0"
                size={"sm"}
                variant={isActive("quote") ? "default" : "ghost"}
                onClick={() => {
                  apply("toggleQuote");
                }}
              >
                <QuoteIcon />
              </Button>
            }
          ></TooltipTrigger>
          <TooltipContent>Cytat</TooltipContent>
        </Tooltip>
      </div>
      <div className={cn(className, "inline-flex gap-2 lg:hidden")}>
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger
            render={
              <Button variant={"ghost"} size={"sm"}>
                <ALargeSmallIcon />
              </Button>
            }
          ></DropdownMenuTrigger>
          <DropdownMenuContent className="w-min px-2">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Formatowanie</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleBold");
                }}
              >
                <BoldIcon />
                Pogrubienie
                {isActive("bold") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleItalic");
                }}
              >
                <ItalicIcon />
                Pochylenie
                {isActive("italic") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Kod</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleCode");
                }}
              >
                <CodeXmlIcon />W tekście
                {isActive("code") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  insertBlockCode();
                }}
              >
                <CodeIcon />
                Blok
                {isActive("blockCode") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Matematyka</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  insertInlineMath();
                }}
              >
                <SigmaIcon />W tekście
                {isActive("inlineMath") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  insertBlockMath();
                }}
              >
                <PiIcon />
                Blok
                {isActive("blockMath") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Link</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  setDialogOpen(true);
                  setDropdownOpen(false);
                }}
              >
                <LinkIcon />
                Link
                {isActive("link") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Nagłówki</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleH1");
                }}
              >
                <Heading1Icon />
                Tytuł
                {isActive("header") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleH2");
                }}
              >
                <Heading2Icon />
                Podtytuł
                {isActive("header-2") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleH3");
                }}
              >
                <Heading3Icon />
                Sekcja
                {isActive("header-3") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Listy</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleBulletList");
                }}
              >
                <ListIcon />
                Nieuporządkowana
                {isActive("bullet-list") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleNumberedList");
                }}
              >
                <ListOrderedIcon />
                Uporządkowana
                {isActive("numbered-list") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Cytat</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => {
                  apply("toggleQuote");
                }}
              >
                <QuoteIcon />
                Cytat
                {isActive("quote") && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="absolute top-0 right-0 mx-2 my-1">
        <Button
          id="toggle-edit"
          size={"sm"}
          variant={"ghost"}
          onClick={() => {
            showPreview(!preview);
          }}
        >
          {preview ? (
            <span className="inline-flex items-center gap-2 md:p-1">
              <span className="not-md:hidden">Edytuj</span> <SquarePenIcon />
            </span>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-2 overflow-hidden transition-all duration-200 ease-in-out md:p-1",
                "max-w-full opacity-100",
                "not-group-focus-within:max-w-0 not-group-focus-within:p-0 not-group-focus-within:opacity-0",
              )}
            >
              <span className="not-md:hidden">Podgląd</span> <EyeIcon />
            </span>
          )}
        </Button>
      </div>
      <LinkDialogMobile
        editorRef={editorRef}
        open={dialogOpen}
        setOpen={setDialogOpen}
      />
    </div>
  );
}

interface LinkButtonProps {
  isActive: (format: string) => boolean;
  editorRef: React.RefObject<OverTypeInstance | null>;
}

function LinkButton({ isActive, editorRef }: LinkButtonProps) {
  const [url, setUrl] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);

  function insertLink() {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    if (url !== "") {
      markdownActions.insertLink(ta, { url });
      setOpen(false);
      requestAnimationFrame(() => {
        ta.focus();
      });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  className="aspect-square p-0"
                  size="sm"
                  variant={isActive("link") ? "default" : "ghost"}
                >
                  <LinkIcon />
                </Button>
              }
            />
          }
        />
        <TooltipContent>
          Link <Kbd>Ctrl + K</Kbd>
        </TooltipContent>
      </Tooltip>

      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Adres URL</PopoverTitle>
          <PopoverDescription>Podaj adres URL linku</PopoverDescription>
        </PopoverHeader>
        <Input
          id="url-input"
          type="url"
          placeholder="https://www.example.com"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
        />
        <Button
          onClick={() => {
            insertLink();
            setUrl("");
          }}
        >
          Dodaj link
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface LinkDialogMobileProps {
  editorRef: React.RefObject<OverTypeInstance | null>;
  open: boolean;
  setOpen: (value: boolean) => void;
}

function LinkDialogMobile({ editorRef, open, setOpen }: LinkDialogMobileProps) {
  const [url, setUrl] = useState<string>("");

  function insertLink() {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    if (url !== "") {
      markdownActions.insertLink(ta, { url });
      setOpen(false);
      requestAnimationFrame(() => {
        ta.focus();
      });
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adres URL</DialogTitle>
          <DialogDescription>Podaj adres URL linku</DialogDescription>
        </DialogHeader>
        <Input
          id="url-input"
          type="url"
          placeholder="https://www.example.com"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
        />
        <Button
          onClick={() => {
            insertLink();
            setUrl("");
          }}
        >
          Dodaj link
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export { OverTypeEditor };
