# Landing page

The anonymous `/` route renders `LandingPage`; authenticated visitors continue
to the application. For local work, open `/?landing=true`.

## Module map

- `landing-page.tsx` composes the page and imports the feature-owned plain CSS.
- `landing-theme.css` registers Tailwind variants, fonts, and animation tokens.
- `landing.css` contains only selectors that utilities cannot express: app-shell
  overrides and DOM owned by CanvasUI, CSS3DRenderer, or devices.css.
- `breakpoints.ts` mirrors Tailwind's default breakpoints for browser queries
  and owns the independent 3D scene widths.
- `components/` contains shared landing primitives.
- `sections/` contains page sections and the interactive product showcase.
- `scene/` owns the device stack, camera framing, and Three.js choreography.
- `capture/` is the development-only device-cover capture route.
- `src/components/testownik-preview/` composes real application components with
  local fixtures for the device screens and showcase.

## Non-obvious constraints

CanvasUI's Bubble and Glass shaders sample RGB but discard alpha. Their captured
subtrees must therefore paint an opaque background; transparent pixels become
black. The Bubble capture background is the `.lp-bubble-capture` escape hatch in
`landing.css`.

The device layer must remain a sibling above the Bubble. CanvasUI rasterizes its
subtree into a canvas and cannot host the hero's WebGL renderer.

Each live device screen is a `CSS3DObject` attached to the corresponding display
mesh. It intentionally shares the Three.js camera and physical transform; a
separate flat DOM overlay will drift during the lid and satellite motion.

## Regenerating the loading cover

Regenerate both theme covers after changing the closed pose, camera framing,
device models, or product surfaces:

```sh
pnpm dev
pnpm capture:device-stack
```

The capture command expects Chrome and the development server at
`http://localhost:3000`. It renders the real WebGL and CSS3D stack at 4×,
preserves transparency, and writes the light and dark WebP files documented in
`public/models/README.md`.

## Validation

```sh
pnpm typecheck
npx eslint --no-cache .
pnpm test --run
pnpm build
```
