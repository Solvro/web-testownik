/**
 * The macOS menu bar across the top of the hero MacBook's screen.
 *
 * Proportions follow a notched 14" MacBook Pro, measured with NSScreen at its
 * 1800 × 1169 pt scaling. Our screen host is 940 px wide, so 1 pt = 0.52 px:
 *
 * - the bar is the band above the 16:10 area, i.e. the 38 pt safe-area top
 *   (3.25% of the height) → 20 px. The notch itself is drawn by
 *   `.lp-screen-laptop::after` in landing.css at 19 px, so it overlays the
 *   middle of this bar;
 * - menu titles are 13 pt SF Pro → 7–8 px, kept at 8 px for legibility, with
 *   ~20 pt between titles → 12 px (titles read slightly large, by design);
 * - status items sit right of the notch in macOS's default order
 *   (battery, Wi-Fi, Spotlight, Control Center, then the clock).
 *
 * The clock uses macOS's Polish format, "weekday. day month time". The date
 * is fixed rather than live: 9 January 2007, 9:41, the moment of Apple's
 * iPhone keynote that every Apple product shot shows.
 *
 * The bar is translucent like the real material, but has no backdrop blur:
 * nothing scrolls beneath it here, and a backdrop filter inside the CSS3D
 * layer would cost a filter pass every frame of the hero's scroll.
 */

const MENU_BAR_ITEMS = ["Plik", "Edycja", "Widok", "Okno", "Pomoc"] as const;

/**
 * Apple logo from Simple Icons (simpleicons.org, `apple`, CC0-1.0). The
 * artwork's copyright is waived; the logo is still Apple's trademark, used
 * here only to depict a Mac.
 */
function AppleLogo(): React.JSX.Element {
  return (
    <svg className="size-[9px]" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/*
 * The status glyphs are drawn here after the SF Symbols macOS uses
 * (`battery.100percent`, `wifi`, `magnifyingglass`, `switch.2`); SF Symbols
 * themselves may only be used in apps for Apple platforms.
 */

function BatteryGlyph(): React.JSX.Element {
  return (
    <svg className="h-[7px] w-[15px]" fill="none" viewBox="0 0 25 12">
      <rect
        height="11"
        opacity="0.4"
        rx="3"
        stroke="currentColor"
        width="21"
        x="0.5"
        y="0.5"
      />
      <rect fill="currentColor" height="8" rx="1.6" width="18" x="2" y="2" />
      <path
        d="M23 4v4a2.2 2.2 0 0 0 1.4-2A2.2 2.2 0 0 0 23 4Z"
        fill="currentColor"
        opacity="0.4"
      />
    </svg>
  );
}

function WifiGlyph(): React.JSX.Element {
  return (
    <svg className="h-[7.5px] w-[10px]" fill="currentColor" viewBox="0 0 16 12">
      <path d="M8 2.2a9.9 9.9 0 0 1 6.9 2.8l1.1-1.1A11.5 11.5 0 0 0 8 .6 11.5 11.5 0 0 0 0 3.9L1.1 5A9.9 9.9 0 0 1 8 2.2Z" />
      <path d="M8 5.4c1.9 0 3.6.7 4.9 1.9L14 6.2A8.4 8.4 0 0 0 8 3.8 8.4 8.4 0 0 0 2 6.2l1.1 1.1A7 7 0 0 1 8 5.4Z" />
      <path d="M8 8.6c1 0 1.9.4 2.6 1L8 12.2 5.4 9.6c.7-.6 1.6-1 2.6-1Z" />
    </svg>
  );
}

function SpotlightGlyph(): React.JSX.Element {
  return (
    <svg
      className="size-[8.5px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.9"
      viewBox="0 0 14 14"
    >
      <circle cx="5.8" cy="5.8" r="4.6" />
      <path d="m9.3 9.3 3.7 3.7" />
    </svg>
  );
}

function ControlCenterGlyph(): React.JSX.Element {
  return (
    <svg className="h-[8px] w-[10px]" fill="currentColor" viewBox="0 0 16 13">
      <path
        d="M3.4.6h9.2a2.9 2.9 0 0 1 0 5.8H3.4a2.9 2.9 0 0 1 0-5.8Zm0 1.3a1.6 1.6 0 1 0 0 3.2h4.5a2.9 2.9 0 0 1 0-3.2H3.4Z"
        fillRule="evenodd"
      />
      <circle cx="10.7" cy="3.5" r="1.6" />
      <path
        d="M3.4 6.6h9.2a2.9 2.9 0 0 1 0 5.8H3.4a2.9 2.9 0 0 1 0-5.8Zm4.7 1.3a2.9 2.9 0 0 1 0 3.2h4.5a1.6 1.6 0 1 0 0-3.2H8.1Z"
        fillRule="evenodd"
      />
      <circle cx="5.3" cy="9.5" r="1.6" />
    </svg>
  );
}

export function LaptopMenuBar(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="flex h-[20px] shrink-0 items-center justify-between bg-white/70 pr-[11px] pl-[13px] font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',Helvetica,Arial,sans-serif] text-[8px] leading-none font-medium tracking-[-0.01em] text-black/85 antialiased select-none dark:bg-black/35 dark:text-white/90"
    >
      <div className="flex items-center gap-[12px]">
        <AppleLogo />
        <span className="font-bold">Testownik</span>
        {MENU_BAR_ITEMS.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <div className="flex items-center gap-[10px]">
        <BatteryGlyph />
        <WifiGlyph />
        <SpotlightGlyph />
        <ControlCenterGlyph />
        <span className="ml-[1px] tabular-nums">wt. 9 sty 9:41</span>
      </div>
    </div>
  );
}
