import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-border bg-input dark:bg-input h-10 w-full min-w-0 rounded-[10px] border px-4 py-2.5 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        // Placeholder
        "placeholder:text-muted-foreground",
        // File
        "file:text-foreground file:bg-input file:inline-flex file:h-7 file:border-0 file:text-sm file:font-normal",
        // Selection
        "selection:bg-primary selection:text-primary-foreground",
        // Focus
        "focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px]",
        // Invalid
        "aria-invalid:ring-destructive dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive aria-invalid:border-destructive aria-invalid:ring-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
