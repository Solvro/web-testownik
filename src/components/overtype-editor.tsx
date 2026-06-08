import katex from "katex";
import "katex/dist/katex.min.css";
import {
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
import type { OverTypeInstance, Theme } from "overtype";
import OverType, { markdownActions } from "overtype";
import React, { useEffect, useState } from "react";

import { useOverType } from "@/hooks/use-overtype";
import { cn } from "@/lib/utils";

import { Button } from "./ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "./ui/button-group";
import { Input } from "./ui/input";
import { Kbd } from "./ui/kbd";
import { Label } from "./ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface OverTypeEditorProps {
  value?: string;
  placeholder?: string;
  theme?: "solar" | "cave" | Theme;
  onChange?: (value: string) => void;
  onPaste?: (event: ClipboardEvent) => void;
  className?: string;
}

const isInCodeBlock = (ta: HTMLTextAreaElement): boolean => {
  const value_ = ta.value;
  const cursor = ta.selectionStart;

  // Count how many ``` appear before the cursor
  const before = value_.slice(0, cursor);
  const fencesBefore = (before.match(/^```/gm) ?? []).length;

  // Odd number of opening fences = cursor is inside a code block
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

function OverTypeEditor({
  value,
  placeholder,
  theme,
  onChange,
  onPaste,
  className,
}: OverTypeEditorProps) {
  const { containerRef, editorRef } = useOverType({
    value,
    placeholder,
    theme,
    toolbar: false,
    onChange,
    onPaste,
    autoResize: true,
  });

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

      if (isInCodeBlock(ta)) {
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

  // useEffect(() => {
  //   const ta = editorRef.current?.textarea;
  //   if (!ta) return;

  //   // OverType is NOT Shadow DOM — preview is a regular DOM element
  //   const wrapper = ta.closest(".overtype-wrapper");
  //   if (!wrapper) return;
  //   const preview = wrapper.querySelector(".overtype-preview");
  //   if (!preview) return;

  //   // Inject styles into the document head once
  //   const styleId = "ot-math-styles";
  //   if (!document.getElementById(styleId)) {
  //     const style = document.createElement("style");
  //     style.id = styleId;
  //     style.textContent = `
  //     .ot-math-inline {
  //       color: red;
  //       font-style: italic;
  //     }
  //     .ot-math-block {
  //       color: var(--color-indigo-400);
  //       font-style: italic;
  //     }
  //   `;
  //     document.head.appendChild(style);
  //   }

  //   const processMath = (node: Element) => {
  //     node.childNodes.forEach((child) => {
  //       if (child.nodeType !== Node.TEXT_NODE) return;
  //       const text = child.textContent ?? "";
  //       if (!text.includes("$")) return;

  //       const span = document.createElement("span");

  //       span.innerHTML = text
  //         .replace(/\$\$([^$]+)\$\$/g, (_, math) => {
  //           try {
  //             return katex.renderToString(math.trim(), {
  //               throwOnError: false,
  //               displayMode: true,
  //             });
  //           } catch {
  //             return `<span class="ot-math-error">$$${math}$$</span>`;
  //           }
  //         })
  //         .replace(/\$([^$\n]+)\$/g, (_, math) => {
  //           try {
  //             return katex.renderToString(math.trim(), {
  //               throwOnError: false,
  //               displayMode: false,
  //             });
  //           } catch {
  //             return `<span class="ot-math-error">$${math}$</span>`;
  //           }
  //         });

  //       child.replaceWith(span);
  //     });
  //   };

  //   let timeout: ReturnType<typeof setTimeout>;

  //   const observer = new MutationObserver(() => {
  //     clearTimeout(timeout);
  //     timeout = setTimeout(() => {
  //       preview.querySelectorAll("div").forEach(processMath);
  //     }, 150);
  //   });

  //   observer.observe(preview, { childList: true, subtree: true });

  //   return () => {
  //     observer.disconnect();
  //     document.getElementById(styleId)?.remove();
  //   };
  // }, [editorRef.current?.textarea]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={cn(
        className,
        "border-input placeholder:text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-16 w-full flex-col rounded-md border bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-within:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 md:text-sm",
      )}
    >
      <Toolbar activeFormats={activeFormats} editorRef={editorRef} />
      <div
        className="flex-1"
        ref={containerRef}
        style={{
          isolation: "isolate",
          zIndex: 0,
          position: "relative",
        }}
      />
    </div>
  );
}

interface ToolbarProps {
  activeFormats: Set<string>;
  editorRef: React.RefObject<OverTypeInstance | null>;
}

function Toolbar({ activeFormats, editorRef }: ToolbarProps) {
  const isActive: (format: string) => boolean = (format: string) =>
    activeFormats.has(format);

  const apply = (action: keyof typeof markdownActions) => {
    const ta = editorRef.current?.textarea;
    if (ta === undefined) {
      return;
    }
    (markdownActions[action] as (ta: HTMLTextAreaElement) => void)(ta);
    ta.focus();
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

  return (
    <ButtonGroup className="flex w-full gap-1">
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>
          Pogrubienie <Kbd>Ctrl + B</Kbd>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>
          Pochylenie <Kbd>Ctrl + I</Kbd>
        </TooltipContent>
      </Tooltip>
      <ButtonGroupSeparator />
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Kod w tekście</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Blok kodu</TooltipContent>
      </Tooltip>
      <ButtonGroupSeparator />
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Wzór w tekście</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button
            className="aspect-square p-0"
            size={"sm"}
            variant={"ghost"}
            onClick={() => {
              insertBlockMath();
            }}
          >
            <PiIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Blok wzoru</TooltipContent>
      </Tooltip>
      <ButtonGroupSeparator />
      <LinkButton isActive={isActive} editorRef={editorRef} />
      <ButtonGroupSeparator />
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Tytuł</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Podtytuł</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Sekcja</TooltipContent>
      </Tooltip>
      <ButtonGroupSeparator />
      <Tooltip>
        <TooltipTrigger>
          <Button
            className="aspect-square p-0"
            size={"sm"}
            variant={isActive("bulletList") ? "default" : "ghost"}
            onClick={() => {
              apply("toggleBulletList");
            }}
          >
            <ListIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Lista nieuporządkowana</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <Button
            className="aspect-square p-0"
            size={"sm"}
            variant={isActive("orderedList") ? "default" : "ghost"}
            onClick={() => {
              apply("toggleNumberedList");
            }}
          >
            <ListOrderedIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Lista uporządkowana</TooltipContent>
      </Tooltip>
      <ButtonGroupSeparator />
      <Tooltip>
        <TooltipTrigger>
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
        </TooltipTrigger>
        <TooltipContent>Cytat</TooltipContent>
      </Tooltip>
      <div className="ml-auto">
        <Tooltip>
          <TooltipTrigger>
            <Button
              className="aspect-square p-0"
              size={"sm"}
              variant={"ghost"}
              onClick={() => {
                editorRef.current?.showPreviewMode();
              }}
            >
              <EyeIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tryb podglądu</TooltipContent>
        </Tooltip>
      </div>
    </ButtonGroup>
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
    <Popover
      open={open}
      onOpenChange={(_open: boolean) => {
        setOpen(_open);
      }}
    >
      <PopoverTrigger>
        <Tooltip>
          <TooltipTrigger>
            <Button
              className="aspect-square p-0"
              size={"sm"}
              variant={isActive("link") ? "default" : "ghost"}
            >
              <LinkIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Link <Kbd>Ctrl + K</Kbd>
          </TooltipContent>
        </Tooltip>
      </PopoverTrigger>
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

export { OverTypeEditor };
