"use client";

import "katex/dist/katex.min.css";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const codeSpanOrBlockPattern =
  /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*(?:`|$))/g;
const displayMathPattern = /\\\[([\s\S]*?)\\\]/g;
const inlineMathPattern = /\\\(([\s\S]*?)\\\)/g;

function normalizeLatexSegment(text: string) {
  return text
    .replaceAll(displayMathPattern, (_match: string, math: string) => {
      return `\n$$\n${math.trim()}\n$$\n`;
    })
    .replaceAll(inlineMathPattern, (_match: string, math: string) => {
      return `$${math.trim()}$`;
    });
}

function normalizeLatex(text: string) {
  let result = "";
  let lastIndex = 0;
  for (const match of text.matchAll(codeSpanOrBlockPattern)) {
    result += normalizeLatexSegment(text.slice(lastIndex, match.index));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }
  return result + normalizeLatexSegment(text.slice(lastIndex));
}

function codeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return (value as ReactNode[]).map((item) => codeText(item)).join("");
  }
  return "";
}

function Code({ className, children, ...props }: React.ComponentProps<"code">) {
  const [copied, setCopied] = useState(false);
  const code = codeText(children).replace(/\n$/, "");
  const language = /language-([\w-]+)/.exec(className ?? "")?.[1];
  const block = language !== undefined || code.includes("\n");

  if (!block) {
    return (
      <code
        className={cn(
          "border-border/50 bg-muted/50 rounded-md border px-1.5 py-0.5 font-mono text-[0.85em]",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border">
      <div className="bg-muted/50 text-muted-foreground flex items-center justify-between px-3 py-1.5 text-xs">
        <span className="font-medium lowercase">{language ?? "tekst"}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Kopiuj kod"
                onClick={() => {
                  void navigator.clipboard.writeText(code).then(() => {
                    setCopied(true);
                    window.setTimeout(() => {
                      setCopied(false);
                    }, 2000);
                  });
                }}
              />
            }
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </TooltipTrigger>
          <TooltipContent>{copied ? "Skopiowano" : "Kopiuj"}</TooltipContent>
        </Tooltip>
      </div>
      <pre className="bg-muted/20 overflow-x-auto p-3 text-xs leading-relaxed">
        <code className={className} {...props}>
          {code}
        </code>
      </pre>
    </div>
  );
}

const components: Components = {
  h1: ({ className, children, ...props }) => (
    <h1
      className={cn("mb-2 text-base font-semibold first:mt-0", className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ className, children, ...props }) => (
    <h2
      className={cn("mt-3 mb-1.5 text-sm font-semibold", className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ className, children, ...props }) => (
    <h3
      className={cn("mt-2.5 mb-1 text-sm font-semibold", className)}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn("my-2.5 leading-relaxed first:mt-0 last:mb-0", className)}
      {...props}
    />
  ),
  a: ({ className, children, ...props }) => (
    <a
      className={cn(
        "text-primary hover:text-primary/80 underline underline-offset-2",
        className,
      )}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "border-muted-foreground/30 text-muted-foreground my-2.5 border-s-2 ps-3 italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "marker:text-muted-foreground my-2 ms-4 list-disc space-y-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "marker:text-muted-foreground my-2 ms-4 list-decimal space-y-1",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-2 overflow-x-auto rounded-lg border">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn("bg-muted px-2 py-1.5 text-start font-medium", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border-t px-2 py-1.5", className)} {...props} />
  ),
  pre: ({ children }) => <div className="contents">{children}</div>,
  code: Code,
};

export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="max-w-none min-w-0">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {normalizeLatex(children)}
      </Markdown>
    </div>
  );
}
