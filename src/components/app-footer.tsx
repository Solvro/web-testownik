"use client";

import { SolvroLogo } from "@/components/solvro-logo";

export function AppFooter() {
  return (
    <footer className="bg-background/60 text-muted-foreground bottom-0 left-0 w-full border-t py-1 text-xs backdrop-blur sm:fixed sm:text-sm">
      <div className="flex flex-wrap items-center justify-center gap-1">
        <span>
          © {new Date().getFullYear()}{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/Antoni-Czaplicki"
          >
            Antoni Czaplicki
          </a>
          ,
        </span>
        powered by
        <a
          className="inline-flex items-center gap-1 underline underline-offset-2"
          href="https://solvro.pwr.edu.pl/"
        >
          <SolvroLogo width={24} />
          KN Solvro
        </a>
      </div>
    </footer>
  );
}
