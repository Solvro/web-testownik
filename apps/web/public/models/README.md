# Landing-page device assets

Used only by the landing-page hero (`src/app/(landing)/components/`).
Everything under `/models/` is served as immutable (`next.config.ts`): when a
file changes, bump the `-vN` in its name (and every reference), or the `?v=`
in `scene/device-models-url.ts` for the model.

## `device-stack.glb`

MacBook, iPad and iPhone in one meshopt-compressed glTF, loaded by
`scene/three/models.ts`. A build artefact: regenerate it, do not edit it.

The runtime looks these nodes up by name:

| Node             | What it is                                                |
| ---------------- | --------------------------------------------------------- |
| `laptop`         | MacBook root, identity rotation                           |
| `laptop-hinge`   | Synthetic pivot at the hinge axis; rotate about X to open |
| `laptop-lid`     | Lid assembly, re-parented onto the hinge                  |
| `laptop-display` | MacBook panel, blanked to dark glass                      |
| `tablet`         | iPad root                                                 |
| `tablet-display` | iPad screen, blanked to dark glass                        |
| `phone`          | iPhone root                                               |
| `phone-display`  | iPhone screen, blanked to dark glass                      |

The `*-display` meshes are not welded or quantised: `SCREEN_PLACEMENT` and
`SATELLITE_RIG` in `scene/three/screens.ts` are measured from them, and
`screens.test.ts` fails if they no longer match.

### Regenerating

```sh
# Put macbook.usdz, ipad.usdz and iphone.usdz into
# apps/web/scripts/export-device-models/source/ (git-ignored), then:
pnpm --filter @testownik/web export:device-models
```

`DEVICE_MODELS_SOURCE=/some/dir` reads the sources from elsewhere. Needs a
local Chrome (`scripts/export-device-models/prepare-scene.js` runs headless).

Afterwards bump `?v=`, compare the closed and open pose
(`?landing=true&capture=devices&captureProgress=0` and `…=1`, see
`capture/capture-request.ts`) and recapture the covers if the closed pose
moved. If `screens.test.ts` fails, paste the measurements from its report into
`SCREEN_PLACEMENT`.

## `testownik-device-stack-{closed,open}-{light,dark}-v1.webp`

Captures of the hero's real renderers. `closed` is the cover shown while the
scene loads, cropped to the cover box in `scene/scene-classes.ts`; `open` is
the static hero without WebGL. Recapture after changing the pose, framing,
models, product surfaces or theme colors:

```sh
pnpm dev --port 3123
# In another terminal, from apps/web:
CAPTURE_BASE_URL=http://localhost:3123 pnpm capture:device-stack
CAPTURE_BASE_URL=http://localhost:3123 CAPTURE_POSE=open pnpm capture:device-stack
```

The harness (`scripts/capture-device-stack.mjs`) rejects oversized files and
silhouettes touching the crop edge. Bump the version in the harness and in
`scene/scene-classes.ts` together.

## `testownik-tablet-stats-preview-{light,dark}-v1.webp`

The iPad's still until its live charts load (`scene/device-screen-content.tsx`).

## `testownik-phone-quiz-preview-{light,dark}-v1.webp`

The mobile hero phone's still until its live quiz loads
(`sections/hero-phone.tsx`). Screen only, at 2× the 390 × 841 screen
(780 × 1682), captured from the live surface at `--lp-phone-scale: 1` with the
Dynamic Island, sensors and clock hidden. Recapture when the quiz preview's
first screen changes.
