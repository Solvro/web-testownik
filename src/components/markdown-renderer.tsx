import "katex/dist/katex.min.css";
import Markdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

export function MarkdownRenderer({
  children,
  className,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn("prose dark:prose-invert max-w-none leading-6", className)}
    >
      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children.replaceAll("\n", "  \n")}
      </Markdown>
    </div>
  );
}
