# Landing page

The anonymous `/` route renders `LandingPage`; signed-in visitors can open
`/?landing=true`. `landing-page.tsx` composes the sections; `landing-theme.css`
owns theme/font tokens and `landing.css` the registered progress property,
CanvasUI/CSS3D selectors and CSS phone. `breakpoints.ts` keeps browser queries
aligned with Tailwind: below `lg` the hero uses the CSS phone and its own quiz
session; at `lg` it lazily mounts `hero-desktop-stage.tsx` and the device stack.

## Device screens and input

`scene/three/create-device-stack.ts` combines WebGL hardware with CSS3D screen
hosts attached to the display meshes, sharing their camera and physical
transforms. `screens.ts` contains native screen dimensions and measured mesh
placements, checked against `device-stack.glb` by `screens.test.ts`. Keep
size/layout/paint containment on the hosts, outside their perspective ancestors.

Each host contains an iframe of `/landing-screen/[device]` (laptop, tablet or
phone), so responsive layouts and overlay positioning use that device's native
viewport. `proxy.ts` sets the bare-shell request header defined in
`lib/document-shell.ts`; the root layout skips app chrome, auth, analytics and
surveys for these documents. The proxy strips a supplied shell header from other
routes.
`screen-frame-document.tsx` supplies the frame's theme and tooltip providers.

`scene/screen-frame-protocol.ts` defines validated, same-origin `postMessage`
traffic; receivers also check the source window. The URL supplies initial theme
and quiz channel. The page posts `theme`; frames post `ready` after two animation
frames, `wheel` for unused wheel axes, and `pointer`/`pointerleave`. Each frame
has an eight-second readiness escape hatch if its ready message never arrives.
The stack waits for all three ready surfaces to remain stable before revealing.

`screen-frame-input.ts` lets inner scrollers consume wheel input first and
forwards the rest in the original delta units. The root disables native
overscroll chaining. Chrome can nevertheless chain from a transformed frame:
all three parent listeners use the shared `page-scroll-ownership.ts` instance
to distinguish forwarded scrolls from browser scrolls and drop duplicate
forwarded input during native chaining. A browser takeover on the first tick
can still apply that tick twice; this is documented in `device-screen-frame.tsx`.

Pointer positions are sent at most once per animation frame in screen pixels.
`DeviceStack` provides `projectScreenPoint`, which maps them through the CSS3D
object and camera into page coordinates; `device-screen-frame.tsx` replays a
window `pointermove` for the hero Bubble. The tablet and phone Glass lenses run
inside their own documents because html-in-canvas cannot capture across iframe
boundaries. They mount on first pointer contact; tablet charts also load then,
replacing their seeded chart still. Untouched captures contain neither lens.

The Bubble's captured subtree must paint an opaque background: its shader
samples RGB and discards alpha (`.lp-bubble-capture`). Keep the device layer a
sibling above the Bubble; html-in-canvas cannot host the device WebGL renderer.

## Preview sessions and public AI demo

`components/testownik-preview/` combines real app components with fixtures and
preview services. `use-quiz-preview-state.ts` runs the deterministic
`preview-quiz-machine.ts` reducer, using `@testownik/core/quiz/session` helpers
for answer/progress rules. Each session owns a query cache; settings, history,
share and stats use local services. `PreviewSandbox` intercepts links and bounds
embedded overlays; standalone iframe screens portal overlays to their own body.

The desktop laptop and phone own separate sessions synchronized through
`preview-quiz-sync.ts`: `BroadcastChannel` carries actions and settings, and a
late joiner requests a revisioned snapshot. The channel name is unique per
landing mount. The CSS phone owns an independent session. The showcase has
another shared session and `ChatRuntime` above its tabs
(`product-showcase/showcase-session.tsx`), so answers, chat history and assistant
question edits survive tab changes; it is independent of the hero.

The showcase uses the app's `ChatRuntime`/`ChatThread` in demo mode against
`/ai/landing-demo/chat`, with the app prompt and bounded question tools. Tool
cards save/edit questions through the session's preview services. The public
route shares admission with `/ai/landing-demo`: AI must be enabled and the
provider configured; `LANDING_AI_MODEL` selects `provider:model` (default
`openai:gpt-5.6-luna`). In-memory sliding windows allow 30 requests per client IP
and 600 globally per ten minutes across both endpoints. Client identity uses
the first forwarded IP, then real IP, with an unknown-client bucket; its trust
depends on ingress headers. Admission peeks before reading a streamed,
size-bounded body and consumes the allowance after validation.

Chat accepts at most 65,536 body bytes, 20 messages and 60 questions; further
field/tool limits live in `lib/ai/landing-demo-chat.ts`. The server budgets
6,000 input tokens including prompt, tool schemas, history and results; it
drops complete old turns and rejects an oversized remaining request. It checks
every inference step, allows three steps and 800 output tokens per step, with
no retries. `landing-demo-tokenizer.server.ts` lazily loads local `o200k_base`
ranks with a bounded count cache and a UTF-8 byte-based fallback. Question
images are not fetched. Server failures can use the showcase's local explanation
fallback (`showcase-chat.ts`).

## Progress, peeks and fallback

`--landing-hero-progress` is registered with `inherits: false`. The 12 desktop
animation targets use `attachHeroProgress` callback refs and `data-hero-progress`;
newly mounted targets receive cached progress immediately. `publishHeroProgress`
quantizes to four decimals, writes only those targets and emits the scene event.
Do not move it onto a section or introduce inheriting derived properties: that
would invalidate the screens and other descendants on every scroll frame.
`Hero` owns `useHeroProgress`, which caches geometry on resize/pageshow and reads
only `scrollY` during scrolling. Reduced motion publishes the open pose.

The TOC caches section offsets and shows peeks built by
`sections/toc-section-preview.ts`. Inert clones live in a shadow root with
copied styles, form state and scroll positions; canvas/video/iframes are removed,
with still replacements for the hero and particle wordmark. Cached stages are
parked and activated by class changes. Mutation/input/inner-scroll tracking
refreshes stale peeks during idle periods, crossfading the visible replacement;
resize/theme changes rebuild them. The hero observes only `data-hero-static`.
`components/ui/no-group-has.test.ts` guards all source TS/TSX/CSS against
`group-has-*` and `peer-has-*`, whose generated wildcard selectors caused broad
style invalidation. Use component-scoped arbitrary variants instead.

A WebGL2 creation failure shows the themed open-pose still, removes live screens
and switches the desktop hero to one viewport with visible copy and static
study badges, without scroll publishers, lid progress or a scroll-to-open hint.
A lost context shows that still while retaining the scene/screens for 15 seconds;
restoration resumes at current progress. Expiry disposes the stack and selects
the static layout; a later context-restored event can recreate it. Creation
failures do not retry on scroll. The TOC rebuilds the hero peek for the shorter
static layout.

## Covers and verification

The closed loading cover stays above the live scene until screen readiness,
then fades after a 150 ms delay over 150 ms. A scrolled arrival holds the closed
pose through that fade before catching up. `scene-classes.ts` shares placement
with the pre-mount hero placeholder; `laptop-framing.ts` supplies the camera and
cover solver. The separate open-pose images are the WebGL fallback. Asset names
and provenance are documented in `public/models/README.md`.

From `apps/web`:

```sh
pnpm dev --port 3123
# In another terminal:
CAPTURE_BASE_URL=http://localhost:3123 pnpm capture:device-stack
CAPTURE_BASE_URL=http://localhost:3123 CAPTURE_POSE=open pnpm capture:device-stack
pnpm exec tsc --noEmit
pnpm lint
pnpm exec vitest run --maxWorkers=2
# From the repository root:
pnpm -w run format:check
```

The development-only capture route accepts `?landing=true&capture=devices`
(live) or `capture=cover` (closed still), `captureTheme=light|dark`,
`captureProgress=0|1`, `captureScale=1..4` and `captureBg=black|green|white`.
The command uses local Chrome with a 1758×1000 viewport and 1.35× DPR, matching
the runtime renderer cap; it trims alpha and writes transparent WebP assets.
Regenerate after model, camera, choreography or screen-content changes.

For a browser/performance harness, use a 1440×900 viewport and Chromium flags
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Measure
scroll after all three iframes report ready; keep CPU throttle and DPR fixed
between runs and record whether html-in-canvas is supported. These software-GPU
measurements do not establish hardware-GPU performance. For a handover check,
keep progress at zero, compare rendered cover/live images in both themes, and
sample screenshots every 100 ms through two seconds after readiness; report
actual sampling times and pixel differences around the fade.
