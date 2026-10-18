import { BatteryFull, Search, Wifi } from "lucide-react";

const MENU_BAR_ITEMS = ["Plik", "Edycja", "Widok", "Okno", "Pomoc"] as const;

/**
 * A slim macOS-style menu bar. It is as tall as the notch drawn by
 * `.lp-screen-laptop::after`, so the app below starts clear of it, exactly as
 * on a real notched MacBook.
 */
export function LaptopMenuBar(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="text-foreground/80 flex h-[22px] shrink-0 items-center justify-between px-4 text-[11px] leading-none select-none"
    >
      <div className="flex items-center gap-4">
        <span className="text-foreground font-bold">Testownik</span>
        {MENU_BAR_ITEMS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="flex items-center gap-3 tabular-nums">
        <Wifi className="size-3" strokeWidth={2.4} />
        <BatteryFull className="size-3.5" strokeWidth={2} />
        <Search className="size-3" strokeWidth={2.4} />
        <span>pt. 9:41</span>
      </div>
    </div>
  );
}
