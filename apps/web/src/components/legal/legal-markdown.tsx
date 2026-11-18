import Link from "next/link";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { splitHeadingAnchor } from "./heading-anchor";

function Heading2({ children }: ComponentProps<"h2">) {
  const heading = splitHeadingAnchor(children);
  return <h2 id={heading.id}>{heading.children}</h2>;
}

function Heading3({ children }: ComponentProps<"h3">) {
  const heading = splitHeadingAnchor(children);
  return <h3 id={heading.id}>{heading.children}</h3>;
}

function Anchor({ href = "", children }: ComponentProps<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return <Link href={href}>{children}</Link>;
  }
  const isWeb = href.startsWith("http");
  return (
    <a href={href} {...(isWeb ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Table({ children }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table>{children}</table>
    </div>
  );
}

const COMPONENTS: Components = {
  h2: Heading2,
  h3: Heading3,
  a: Anchor,
  table: Table,
};

/** Renders a legal document's Markdown; raw HTML in it is not rendered. */
export function LegalMarkdown({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {children}
    </Markdown>
  );
}
