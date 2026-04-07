import {
  BoldIcon,
  CodeIcon,
  EqualIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from "lucide-react";
import React, { ReactElement, useRef } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "./ui/input-group";
import { Separator } from "./ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

function MarkdownTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function addHeading(level: number) {
    const textarea = textareaRef.current;

    if (!textarea) return; // Handle null case

    const { selectionStart, selectionEnd, value } = textarea;

    if (selectionStart === null || selectionEnd === null) return; // Handle null case

    textarea.setRangeText(
      `${"#".repeat(level)} ${value.slice(selectionStart, selectionEnd)}\r\n`,
    );

    textarea.setSelectionRange(selectionStart, selectionEnd);
    textarea.focus();
  }

  return (
    <InputGroup className="group oveflow-hidden">
      <InputGroupTextarea {...props} ref={textareaRef} />
      <InputGroupAddon
        align={"block-start"}
        className="flex border-b px-1! py-1!"
      >
        {/* Heading */}
        <TooltipProvider>
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton className="aspect-square size-auto">
                    <HeadingIcon />
                  </InputGroupButton>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Nagłówek</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="flex flex-col gap-2">
              <DropdownMenuItem
                className="text-muted-foreground hover:bg-muted/50 flex items-center gap-2 p-1 text-sm"
                onSelect={(e) => {
                  addHeading(1);
                  console.log(e.target);
                }}
              >
                <Heading1Icon className="text-muted-foreground size-5" />{" "}
                Nagłówek 1
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-muted-foreground hover:bg-muted/50 flex items-center gap-2 p-1 text-sm"
                onSelect={(e) => addHeading(2)}
              >
                <Heading2Icon className="text-muted-foreground size-5" />{" "}
                Nagłówek 2
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-muted-foreground hover:bg-muted/50 flex items-center gap-2 p-1 text-sm"
                onSelect={(e) => addHeading(3)}
              >
                <Heading3Icon className="text-muted-foreground size-5" />{" "}
                Nagłówek 3
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <BoldIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Pogrubienie</TooltipContent>
        </Tooltip>
        {/* Italic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <ItalicIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Kursywa</TooltipContent>
        </Tooltip>
        {/* Quote */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <QuoteIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Cytat</TooltipContent>
        </Tooltip>
        {/* Code */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <CodeIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Kod</TooltipContent>
        </Tooltip>
        {/* Equation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <EqualIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Równanie</TooltipContent>
        </Tooltip>
        {/* Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <LinkIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Link</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-[1.25rem]!" />
        {/* Ordered List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <ListOrderedIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Lista uporządkowana</TooltipContent>
        </Tooltip>
        {/* Unordered List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <InputGroupButton className="aspect-square size-auto">
              <ListIcon />
            </InputGroupButton>
          </TooltipTrigger>
          <TooltipContent>Lista nieuporządkowana</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-[1.25rem]!" />
      </InputGroupAddon>
    </InputGroup>
  );
}

export default MarkdownTextarea;
