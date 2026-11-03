/**
 * Origin Trial tokens for `HTMLInCanvas`, used by the landing's Bubble and
 * Glass lenses. Both are `isSubdomain` tokens for `https://solvro.pl:443`, so
 * other origins (localhost, previews elsewhere) ignore them. They live in the
 * root layout because the `/landing-screen/[device]` iframes need them too.
 *
 * - Chrome: expires 2027-03-02 00:00 UTC.
 * - Edge: expires 2026-12-08 15:27 UTC.
 */
const HTML_IN_CANVAS_ORIGIN_TRIAL_TOKENS = [
  // Chrome
  "Anlc0Y/13ZCiyt/1EBV5voOsEI68/jg52adAPvv4uzku6TGxEL60/5oFBu/ao6mit7h2U0hIDG7/s0LTTDPpFQ8AAABieyJvcmlnaW4iOiJodHRwczovL3NvbHZyby5wbDo0NDMiLCJmZWF0dXJlIjoiSFRNTEluQ2FudmFzIiwiZXhwaXJ5IjoxODAzOTQ1NjAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=",
  // Edge
  "A977K2psSn0M4wdL3+HYoyT5Z2URH31m4lqZgF4jA4YCO4tHhgo/ZxzX8vBmgH03REmWxeMu+hVVUWn8Np3DG18AAABieyJvcmlnaW4iOiJodHRwczovL3NvbHZyby5wbDo0NDMiLCJmZWF0dXJlIjoiSFRNTEluQ2FudmFzIiwiZXhwaXJ5IjoxNzk2NzQzNjYzLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=",
] as const;

/** Next's metadata `other` field renders `name=`, which origin trials reject. */
export function OriginTrialMetas(): React.JSX.Element {
  return (
    <>
      {HTML_IN_CANVAS_ORIGIN_TRIAL_TOKENS.map((token) => (
        <meta key={token} httpEquiv="origin-trial" content={token} />
      ))}
    </>
  );
}
