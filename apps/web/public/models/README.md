# Landing-page device assets

Everything in this directory is used only by the landing-page hero
(`src/app/(landing)/components/`).

## `device-stack.glb`

The MacBook, iPad and iPhone in one meshopt-compressed binary glTF (807 KB,
440 KB gzip), loaded by `scene/three/models.ts` with three's `GLTFLoader` and
`MeshoptDecoder`. It is a build artefact: regenerate it, do not edit it by hand.

The export bakes in every fix-up, so the runtime only looks nodes up by name:

| Node             | What it is                                                |
| ---------------- | --------------------------------------------------------- |
| `laptop`         | MacBook root, identity rotation                           |
| `laptop-hinge`   | Synthetic pivot at the hinge axis; rotate about X to open |
| `laptop-lid`     | Lid assembly, re-parented onto the hinge                  |
| `laptop-display` | MacBook panel, blanked to dark glass (`#030405`)          |
| `tablet`         | iPad root                                                 |
| `tablet-display` | iPad screen, blanked to dark glass (`#020305`)            |
| `phone`          | iPhone root                                               |
| `phone-display`  | iPhone screen, blanked to dark glass (`#020305`)          |

Every emissive material inside the MacBook lid is blanked, so no baked-in
screenshot can show through. Unused variants and empty nodes are pruned, and the
iPhone shell is toned navy `#22355d`.

The three `*-display` meshes are exempt from welding and quantisation: each
live screen's plane, extent and in-plane axes are measured from their raw
geometry and baked into `SCREEN_PLACEMENT` and `SATELLITE_RIG` in
`scene/three/screens.ts`. `screens.test.ts` re-measures the meshes in this file
and fails if they no longer match. Everything else is welded, quantised and
meshopt compressed.

### Regenerating

```sh
# Put macbook.usdz, ipad.usdz and iphone.usdz into
# apps/web/scripts/export-device-models/source/ (git-ignored), then:
pnpm --filter @testownik/web export:device-models
```

`DEVICE_MODELS_SOURCE=/some/dir` reads the sources from elsewhere. The command
needs a local Chrome: it runs `scripts/export-device-models/prepare-scene.js`
in headless Chrome, then post-processes the result with glTF Transform. The
output is deterministic.

After regenerating, compare the hero with the previous model in the closed and
fully open pose (`?landing=true&capture=devices&captureProgress=0` and `…=1`,
see `capture/capture-request.ts`). If the closed pose moved, regenerate the
covers below. If `screens.test.ts` fails, re-derive the placements with
`scene/three/display-plane.ts` and paste the new values into
`scene/three/screens.ts`.

## `testownik-device-stack-closed-{light,dark}-v1.webp`

The still shown while the model and the three screen iframes become ready. It
is a capture of the hero's real WebGL and CSS3D renderers at the closed pose,
cropped to exactly the cover box `DeviceStack` lays out (`scene-classes.ts`,
solved by `scene/laptop-framing.ts`), so the live scene takes over with a short
fade and no jump. Regenerate both themes after any change to the closed pose,
camera framing, device models, product surfaces or theme colors:

```sh
pnpm dev --port 3123
# In another terminal, from apps/web:
CAPTURE_BASE_URL=http://localhost:3123 pnpm capture:device-stack
```

The harness captures at 1758×1000 CSS pixels and 1.35× DPR (the runtime cap)
and writes lossy WebP with lossless alpha; it rejects a file over 60 KB or a
silhouette touching the crop edge. Bump the file version in the harness and in
`scene/scene-classes.ts` together when the capture geometry changes.

## `testownik-device-stack-open-{light,dark}-v1.webp`

The static hero when WebGL is unavailable or a lost context does not come
back, captured with the same harness at the open pose and trimmed to the
silhouette:

```sh
CAPTURE_BASE_URL=http://localhost:3123 CAPTURE_POSE=open pnpm capture:device-stack
```

## `testownik-tablet-stats-preview-{light,dark}.webp`

The still the iPad shows before its live statistics charts load
(`scene/device-screen-content.tsx`).
