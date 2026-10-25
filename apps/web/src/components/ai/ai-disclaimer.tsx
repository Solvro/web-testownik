import { cn } from "@/lib/utils";

interface AiDisclaimerProps {
  className?: string;
}

export function AiDisclaimer({ className }: AiDisclaimerProps) {
  return (
    <p
      className={cn(
        "text-muted-foreground/70 flex w-full flex-wrap justify-between gap-x-2 gap-y-1 text-[11px] leading-relaxed",
        className,
      )}
    >
      <span>AI can make mistakes.</span>
      <span>
        AI provided by{" "}
        <a
          href="https://github.com/Antoni-Czaplicki"
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground"
        >
          @antek
        </a>
        {", not Solvro."}
      </span>
    </p>
  );
}
