"use client";

import { AppLogo } from "@/components/app-logo";

export function AppFooter() {
  return (
    <footer className="bg-background/60 text-muted-foreground fixed bottom-0 left-0 hidden w-full border-t py-1 text-sm backdrop-blur sm:block">
      <div className="flex items-center justify-center gap-1">
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
          <AppLogo width={24} />
          KN Solvro
        </a>
      </div>
    </footer>
  );
}
