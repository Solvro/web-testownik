/**
 * Fades the hero grid into the page background at the bottom of the stage. A
 * gradient rather than a backdrop blur, because the stage repaints every
 * scrolled frame.
 *
 * Render it inside the element that paints the grid (`.lp-hero-grid` or the
 * Bubble's content box), an isolated stacking context: at `-z-1` it paints over
 * that element's background and under all of its content.
 */
export function HeroFade(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="to-background pointer-events-none absolute inset-x-0 bottom-0 -z-1 h-[clamp(7rem,22vh,13rem)] bg-linear-to-b from-transparent"
    />
  );
}
