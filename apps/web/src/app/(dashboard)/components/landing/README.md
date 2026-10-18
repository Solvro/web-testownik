# Landing page

The anonymous `/` route renders `LandingPage`; authenticated visitors continue
to the application. For local work, open `/?landing=true`.

## Module map

- `landing-page.tsx` composes the page and imports the feature-owned plain CSS.
- `landing-theme.css` registers Tailwind variants, fonts, and animation tokens.
- `landing.css` contains only selectors that utilities cannot express: app-shell
  overrides, DOM owned by CanvasUI or CSS3DRenderer, the CSS iPhone (ported
  from devices.css) and the mobile hero's scroll-driven animation.
- `breakpoints.ts` mirrors Tailwind's breakpoints for browser queries. `lg`
  (`DESKTOP_STAGE_QUERY`) is the one switch between the two heroes; it also
  owns the independent 3D scene widths.
- `sections/hero.tsx` renders the copy, nav and links once. Below `lg` (and as
  the server render) the visual is `hero-phone.tsx`: a CSS iPhone running the
  live quiz (`hero-phone-screen.tsx`, lazy, loaded below `lg` only) with
  scroll-driven CSS motion and no JS. At `lg` it lazily mounts
  `hero-desktop-stage.tsx` (Bubble, device scene, badges, progress bar and
  `useHeroProgress`), so phones never download it. Until it loads, a
  placeholder holds the device cover where `DeviceStack` shows it.
- `components/` contains shared landing primitives.
- `sections/` contains page sections and the interactive product showcase.
- `scene/` owns the device stack, camera framing, and Three.js choreography.
- `capture/` is the development-only device-cover capture route.
- `src/components/testownik-preview/` composes real application components with
  local fixtures for the device screens and showcase. The quiz screens run a
  `PreviewQuizSession` (`hooks/use-quiz-preview-state.ts` over the pure
  `preview-quiz-machine.ts`); on the desktop stage the laptop and the iPhone
  each run one and keep them in step over a `BroadcastChannel`
  (`preview-quiz-sync.ts`), the CSS phone owns its own. Each session has its own query
  cache bound to `preview-services.ts`, so the real settings, share, history
  and stats components read fixtures and never reach the API or the
  clipboard. Links inside a screen are cancelled by `PreviewSandbox` and
  handed to its `onNavigate`, which is how the stats view opens.

## Non-obvious constraints

CanvasUI's Bubble shader samples RGB but discard alpha. Their captured
subtrees must therefore paint an opaque background; transparent pixels become
black. The Bubble capture background is the `.lp-bubble-capture` escape hatch in
`landing.css`.

The device layer must remain a sibling above the Bubble. CanvasUI rasterizes its
subtree into a canvas and cannot host the hero's WebGL renderer.

Each live device screen is a `CSS3DObject` attached to the corresponding display
mesh. It intentionally shares the Three.js camera and physical transform; a
separate flat DOM overlay will drift during the lid and satellite motion.
Where each screen sits on its mesh and how large its DOM host is are baked
constants in `scene/three/screens.ts`, guarded by `screens.test.ts` against
the GLB.

Each host holds an iframe of `/landing-screen/<device>`
(`scene/device-screen-frame.tsx`, contract in `scene/screen-frame-protocol.ts`),
so the app's components lay out at the screen's native width: breakpoints,
dialog variants and Floating UI positions are those of the device, not of the
visitor's monitor seen through the CSS3D perspective. The root layout serves
that route bare (no navbar, auth, analytics; see `lib/document-shell.ts`).
The page passes the theme in the URL and posts changes; each frame posts
`ready` once painted, and the loading cover waits for all three. Nothing
html-in-canvas can reach inside a frame, so the screens have no Glass.

`--landing-hero-progress` changes on every scroll frame and is inherited, so
every element under the hero is restyled each frame unless something pins it.
`DeviceStack` pins it to 0 for the live screens (hundreds of elements); at 4×
CPU throttling that took a hero scroll frame from ~50 ms of style recalc to
~7 ms. Pin it on any new large subtree under the hero that does not read it.

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
