/**
 * Origin Trial tokens for `HTMLInCanvas` (html-in-canvas: `<canvas
 * layoutsubtree>` with `drawElementImage`), which the landing's Bubble and
 * Glass lenses need. Both are first-party `isSubdomain` tokens for
 * `https://solvro.pl:443`, so they cover every `*.solvro.pl` deployment; on
 * any other origin (localhost, previews elsewhere) the browser ignores them.
 *
 * - Chrome: expires 2027-03-02 00:00 UTC (`expiry` 1803945600).
 * - Edge: expires 2026-12-08 15:27 UTC (`expiry` 1796743663).
 *
 * Every document that uses html-in-canvas needs them, including the
 * `/landing-screen/[device]` iframe documents, hence the root layout.
 */
const HTML_IN_CANVAS_ORIGIN_TRIAL_TOKENS = [
  // Chrome
  "Anlc0Y/13ZCiyt/1EBV5voOsEI68/jg52adAPvv4uzku6TGxEL60/5oFBu/ao6mit7h2U0hIDG7/s0LTTDPpFQ8AAABieyJvcmlnaW4iOiJodHRwczovL3NvbHZyby5wbDo0NDMiLCJmZWF0dXJlIjoiSFRNTEluQ2FudmFzIiwiZXhwaXJ5IjoxODAzOTQ1NjAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=",
  // Edge
  "A977K2psSn0M4wdL3+HYoyT5Z2URH31m4lqZgF4jA4YCO4tHhgo/ZxzX8vBmgH03REmWxeMu+hVVUWn8Np3DG18AAABieyJvcmlnaW4iOiJodHRwczovL3NvbHZyby5wbDo0NDMiLCJmZWF0dXJlIjoiSFRNTEluQ2FudmFzIiwiZXhwaXJ5IjoxNzk2NzQzNjYzLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=",
] as const;

/**
 * The trial tokens as `<meta http-equiv="origin-trial">`. Next's metadata
 * `other` field renders `name=`, which origin trials do not accept, so these
 * are rendered in the layout's `<head>` directly.
 */
export function OriginTrialMetas(): React.JSX.Element {
  return (
    <>
      {HTML_IN_CANVAS_ORIGIN_TRIAL_TOKENS.map((token) => (
        <meta key={token} httpEquiv="origin-trial" content={token} />
      ))}
    </>
  );
}
