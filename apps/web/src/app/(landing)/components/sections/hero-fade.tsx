/**
 * The hero's exit into the page below. The grid runs to the bottom of the
 * sticky stage and used to stop on a hard line against the next section; this
 * settles its lines and the bubbles into the page background over the last
 * stretch instead. A gradient rather than a backdrop blur: the stage repaints
 * on every scrolled frame, and a filter pass there would cost more than the
 * softer edge is worth.
 *
 * It fades the grid only, never what sits on it. Render it inside the element
 * that paints the grid (`.lp-hero-grid`, or the Bubble's content box), which is
 * an isolated stacking context: at `-z-1` it paints above that element's own
 * background and beneath every descendant, so the copy, the scroll hint, the
 * "Poznaj produkt" link, the phone and the devices all stay crisp.
 */
export function HeroFade(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="to-background pointer-events-none absolute inset-x-0 bottom-0 -z-1 h-[clamp(7rem,22vh,13rem)] bg-linear-to-b from-transparent"
    />
  );
}
