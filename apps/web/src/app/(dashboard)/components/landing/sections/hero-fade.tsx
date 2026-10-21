/**
 * The hero's exit into the page below. The grid runs to the bottom of the
 * sticky stage and used to stop on a hard line against the next section; this
 * settles its lines and the bubbles into the page background over the last
 * stretch instead. A gradient rather than a backdrop blur: the stage repaints
 * on every scrolled frame, and a filter pass there would cost more than the
 * softer edge is worth. It sits above the Bubble and below the devices, the
 * logo and the scroll hint, which stay crisp.
 */
export function HeroFade(): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="to-background pointer-events-none absolute inset-x-0 bottom-0 z-2 h-[clamp(7rem,22vh,13rem)] bg-linear-to-b from-transparent"
    />
  );
}
