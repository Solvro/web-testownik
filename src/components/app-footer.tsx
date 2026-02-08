"use client";

import { Caveat } from "next/font/google";

import { SolvroLogo } from "@/components/solvro-logo";

const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
});

export function AppFooter() {
  return (
    <footer className="bg-background/60 text-muted-foreground fixed bottom-0 left-0 hidden w-full border-t py-3 text-sm backdrop-blur sm:block">
      <div className="flex items-center justify-around gap-1">
        <div className="text-primary flex items-center justify-center gap-2">
          <span className={caveat.className}>Powered by</span>
          <a
            className="inline-flex items-center gap-1"
            href="https://solvro.pwr.edu.pl/"
          >
            <SolvroLogo width={24} />
            KN Solvro
          </a>
        </div>
        <span className="text-primary">
          © {new Date().getFullYear()}{" "}
          <a href="https://github.com/Antoni-Czaplicki">Antoni Czaplicki</a>
        </span>
      </div>
    </footer>
  );
}
