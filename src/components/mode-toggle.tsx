import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ModeToggle() {
  const { setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Tooltip key={menuOpen ? "disabled" : "enabled"}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <SunIcon className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <MoonIcon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setTheme("light");
            }}
          >
            Jasny
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setTheme("dark");
            }}
          >
            Ciemny
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setTheme("system");
            }}
          >
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipContent side="bottom">
        <p>Wybierz motyw</p>
      </TooltipContent>
    </Tooltip>
  );
}
