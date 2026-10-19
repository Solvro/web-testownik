# Landing-page device assets

Everything in this directory is used only by the landing-page hero
(`src/app/(dashboard)/components/landing/`).

## `device-stack.glb`

The MacBook, iPad and iPhone in one meshopt-compressed binary glTF, loaded by
`scene/three/models.ts` with three's `GLTFLoader` and `MeshoptDecoder`. It is a
build artefact: do not edit it by hand, regenerate it.

| Stage                                           | Size                                |
| ----------------------------------------------- | ----------------------------------- |
| Previous runtime download (three `.usdz` files) | 6.75 MB (2.80 MB gzip)              |
| `device-stack.glb`                              | 807 KB (440 KB gzip, 405 KB brotli) |

The export bakes in every fix-up the hero used to do at runtime, so the runtime
only looks nodes up by name:

| Node             | What it is                                                |
| ---------------- | --------------------------------------------------------- |
| `laptop`         | MacBook root, identity rotation                           |
| `laptop-hinge`   | Synthetic pivot at the hinge axis; rotate about X to open |
| `laptop-lid`     | Apple's lid assembly, re-parented onto the hinge          |
| `laptop-display` | MacBook panel, blanked to dark glass (`#030405`)          |
| `tablet`         | iPad root                                                 |
| `tablet-display` | iPad screen, blanked to dark glass (`#020305`)            |
| `phone`          | iPhone root                                               |
| `phone-display`  | iPhone screen, blanked to dark glass (`#020305`)          |

Every emissive material inside the MacBook lid is blanked, not only the panel's,
so no baked-in screenshot can show through. Inactive variants (Magic Keyboard,
Pencil, Pro Max) and their empty nodes are pruned.

The iPhone shell is re-toned to navy `#22355d`. Apple's file is Cosmic Orange,
and until commit `a49fa98d` the hero re-toned the orange materials to this navy
at runtime. The trimmed `iphone.usdz` instead tints the shell near-black
(`#020305`, roughness 0.5, roughness map dropped), and with no environment map
that rendered pure black. The export puts the old tone back on the trim's shell
(at roughness 0.41, the mean of the dropped map) and on the orange parts it
left. The trim also removed the bottom port and speaker grille meshes, so their
detail is gone. The MacBook and iPad render as they did before the trim.

The three `*-display` meshes are exempt from welding and quantisation. Each
live screen's plane, extent and in-plane axes were measured from those meshes'
raw vertices, normals and UVs (8-bit normals tilted the MacBook's live UI by
about 0.3°, and welding the iPhone screen shrank its UI by 0.4%). The results
are baked into `SCREEN_PLACEMENT` and `SATELLITE_RIG` in
`scene/three/screens.ts`; `screens.test.ts` re-measures the display meshes in
this file and fails if they no longer match. Everything else is welded,
quantised (positions 14-bit, UVs 12-bit with `KHR_texture_transform`, normals
8-bit) and meshopt compressed.

### Regenerating

```sh
# Put macbook.usdz, ipad.usdz and iphone.usdz into
# apps/web/scripts/export-device-models/source/ (git-ignored), then:
pnpm --filter @testownik/web export:device-models
```

Set `DEVICE_MODELS_SOURCE=/some/dir` to read the sources from elsewhere. The
command needs a local Chrome installation, like `capture:device-stack`. It
serves the sources and three.js from a throwaway local server, runs
`scripts/export-device-models/prepare-scene.js` in headless Chrome (USDLoader
needs `Image`, and GLTFExporter needs a canvas), then post-processes the result
with glTF Transform in Node. The output is deterministic: the same sources
produce byte-identical output.

After regenerating, check the hero against the previous model in both the
closed and fully open pose (`?landing=true&capture=devices&captureProgress=0`
and `…=1`, see `capture/capture-request.ts`). If the closed pose moved at all,
regenerate the loading covers below. If the display geometry changed,
`screens.test.ts` fails: re-derive the placements with the solver they were
baked from (`scene/three/display-plane.ts` and `screens.ts` as of commit
`d9589472`) and paste the new values into `scene/three/screens.ts`.

### Sources

The sources are not in the working tree; they are only needed to regenerate.
They derive from the public AR Quick Look models Apple serves on its product
pages:

- MacBook Pro 14" —
  `https://www.apple.com/105/media/us/macbook-pro/2025/785e1bc4-d1bd-4cf4-b1b3-94b9411c9e74/ar/macbook-pro-14-in-space-black-variant.usdz`
- iPad Pro —
  `https://www.apple.com/105/media/us/ipad-pro/2025/adee90db-c01e-430d-b726-fe64c0063f08/ar/ipad-pro-space-black.usdz`
- iPhone 17 Pro —
  `https://www.apple.com/105/media/us/iphone-17-pro/2025/704d4474-8e63-4ce7-9917-bb47b1ca4ba0/ar/iphone-17-pro-e-sim.usdz`

The files the export expects (`macbook.usdz` 3.5 MB, `ipad.usdz` 1.4 MB,
`iphone.usdz` 1.9 MB) are not those originals but trimmed derivatives of them
(downsized textures, the iPhone retinted, unused variants removed), added in
commit `a49fa98d` ("optimize hero section"). How they were trimmed is not
recorded. They were removed from `public/models/` when the hero switched to the
GLB; restore them from the commit before that deletion:

```sh
git log --diff-filter=D --format=%h -- apps/web/public/models/macbook.usdz
git show <commit>^:apps/web/public/models/macbook.usdz \
  > apps/web/scripts/export-device-models/source/macbook.usdz
# likewise ipad.usdz and iphone.usdz
```

If the landing branch was squash-merged, that history only survives on the
branch of PR Solvro/web-testownik#316.

Exporting straight from Apple's originals works mechanically but will not
reproduce the current look exactly.

Apple's terms for redistributing these assets have not been reviewed. The
maintainers should confirm that shipping a derivative of them is acceptable.

## `testownik-device-stack-cover-{light,dark}-v8.webp`

The still shown while `device-stack.glb` downloads. It is a capture of the
hero's real WebGL and CSS3D renderers, including the live Testownik surfaces,
trimmed and placed by `scripts/capture-device-stack.mjs`. The cover and the
live camera are laid out by the same solver (`scene/laptop-framing.ts`), so the
hand-off is a pure cross-fade. Regenerate both themes after changing the closed
pose, camera framing, device models or product surfaces:

```sh
pnpm dev
pnpm capture:device-stack
```

## `testownik-tablet-stats-preview-{light,dark}.webp`

The still the iPad shows before its live statistics charts load
(`scene/device-screen-content.tsx`).
