# Landing page

The anonymous `/` route renders `LandingPage`; signed-in visitors can open
`/?landing=true`.

## Structure

- `landing-page.tsx` composes the sections in `sections/`. The story, FAQ
  and partner copy are in `landing-content.ts`, section ids and TOC labels in
  `landing-sections.ts`, the partner numbers and offers in `../data/perks.ts`.
- Styling is Tailwind utilities, including on DOM created from script
  (`scene/scene-classes.ts`, the TOC peek stages). `landing.css` holds only
  what utilities cannot express: the registered progress property, keyframes,
  scroll-driven animation, app-shell and CanvasUI selectors and pseudo-element
  chrome.
- `breakpoints.ts` keeps browser queries in step with Tailwind's `lg`, the
  switch between the two heroes.
- In-page links go through `followLandingSectionLink` (`scroll-to-section.ts`),
  which scrolls, updates the hash and moves focus. Every section is a focus
  target (`tabIndex={-1}`).

## Hero

Below `lg` the hero is a CSS phone running its own preview quiz session. At
`lg` it lazily mounts `hero-desktop-stage.tsx`: a WebGL device stack
(`scene/three/`) with CSS3D screen hosts on the display meshes. Each host is an
iframe of `/landing-screen/[device]`, so layouts use the device's own viewport;
`proxy.ts` marks those documents so the root layout skips app chrome.
`scene/screen-frame-protocol.ts` defines the validated `postMessage` traffic
between page and frames (theme, readiness, pointer positions).

Scroll drives the scene through `--landing-hero-progress` (`hero-progress.ts`,
`hooks/use-hero-progress.ts`). It is written only to the elements that animate
on it and does not inherit, so scrolling never restyles the screens. Without
WebGL2, or after a lost context that does not come back, the hero falls back to
a static layout with the open-pose still.

The Bubble and the tablet and phone Glass lenses use html-in-canvas
(`../canvasui/`) and render plain DOM where it is unavailable.

## Previews and demos

`../preview/` mounts real app components on fixtures (`preview-fixtures.ts`)
and offline services, each session with its own query cache.
`preview-quiz-machine.ts` is the quiz session reducer. The laptop and phone
screens share a session through `preview-quiz-sync.ts`.

The showcase (`sections/product-showcase/`) has one session and chat runtime
shared by its tabs. Its chat talks to `/ai/landing-demo/chat`
(`../ai/landing-demo/`, server code and limits in `../lib/`), which is rate
limited and only answers when AI is enabled; `LANDING_AI_MODEL` selects the
model.

## Table of contents

`sections/toc/` holds the side rail. `use-toc-rail.ts` tracks the active
section and auto-hides the rail (visually only; it stays tabbable).
`use-toc-preview.ts` runs the hover peeks, which `toc-section-preview.ts`
builds while idle, keeps current and parks in a shadow root on the card;
`toc-preview-clone.ts` builds each stage from the live section and
`toc-shadow-styles.ts` copies the page CSS in. A clone shows reveal effects
finished; a new reveal needs the same treatment there.

`src/components/ui/no-group-has.test.ts` forbids `group-has-*` and
`peer-has-*`, whose selectors make every DOM insertion restyle the document.

## Commands

From `apps/web`:

- `pnpm exec vitest run "src/app/(landing)"` runs the landing tests.
- `pnpm capture:device-stack` and `pnpm export:device-models` regenerate the
  hero stills and models; see `public/models/README.md`.
- The development-only capture route is `/?landing=true&capture=devices`
  (live) or `capture=cover` (closed still), with `captureTheme=light|dark`,
  `captureProgress=0|1`, `captureScale=1..4` and
  `captureBg=black|green|white`.
