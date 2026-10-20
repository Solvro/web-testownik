# Cover verification — 2026-10-20

Baseline: `61bc0e95`. Tested locally on port 3123 at 1440×900 CSS pixels,
1.35× DPR, closed progress 0, both themes, without pointer interaction.

## Comparison and changes

The v8 cover/live alpha silhouette intersection-over-union was **98.966%** in
both themes (alpha threshold 127), confirming the earlier approximately 99%
measurement. The content was stale: the phone's check button appeared above its
AI hint instead of in the bottom action dock.

Regenerated both closed covers and versioned them as **v9**; updated the shared
cover class and capture output filename. Regenerated both open-pose v1 stills
with `CAPTURE_POSE=open`. The capture stylesheet now hides the entire TanStack
launcher container and matches its label case-insensitively: the previous
selector missed `Open Tanstack query devtools`, contaminating the open image
and expanding its alpha trim. Final open images are 1600×621 with transparency.
The lossless closed files are approximately 208 KB light / 200 KB dark, up from
41 KB / 37 KB for v8; this follows the existing capture encoder settings.

The refreshed closed cover contains the current question card, AI hint and
docked actions. Against the live closed scene:

- Silhouette intersection-over-union: **98.958%**, both themes.
- Mean absolute RGB difference across 1440×900: **1.166/255 light**,
  **0.839/255 dark**.
- Pixels with any channel difference greater than 16: **1.632% light**,
  **1.330% dark**.

These comparisons premultiply RGB by alpha against black and exclude the
bottom-right development-launcher area. The images are **not pixel-identical**:
resampling the 983×698 still, CSS3D text rasterization, fine highlights/edges and
the running study clock remain different. The closed MacBook panel is invisible
at progress 0; its changed screen ramp is represented by the open capture.

## Handover sampling

Requested screenshots on a 100 ms schedule from navigation through at least two
seconds after `data-model-ready=true`. Used Chromium headless shell with
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` and
`--disable-gpu-compositing`; CDP screenshots avoid Playwright's font-ready wait.
The isolated capture route uses a white light-theme background and black dark
theme background. All three iframe ready messages were observed.

- Light: 38 screenshots; median interval **100.7 ms**; last sample **2057 ms**
  after model readiness.
- Dark: 33 screenshots; median interval **101.3 ms**; last sample **2077 ms**
  after model readiness.
- Fade sample intervals: light **92.3/101.7 ms**; dark
  **105.1/92.6/101.4 ms**, followed by stable post-fade frames.
- Maximum consecutive per-channel difference around handover: **253/255 light**,
  **177/255 dark**. Maximum whole-viewport mean difference: **0.602/255 light**,
  **0.306/255 dark**. The corresponding maximum mean within the 720×390 device
  region was **2.777/255 light**, **1.411/255 dark**.

Inspected samples show the content staying in place through the fade, without
blank screens or a large pose jump; fine raster/edge changes remain. Software
rendering caused startup gaps up to **3083 ms light / 4491 ms dark**, including
**1321/2781 ms** gaps before the first sampled fade frame. This is a best-effort
100 ms recording, not uninterrupted 10 Hz evidence or a hardware-GPU acceptance
claim. Plain Chrome screenshots were slower; compositor screencasts returned
stale pixels and were excluded from the reported handover results.

Raw PNGs, scripts and JSON metrics are retained locally under
`/tmp/testownik-covers-20261020/`: `before/`, `after/`, `handover-cpu/`,
`summary.json`. Only the corrected `after/` metrics and `handover-cpu/` sequence
are used above.

## Gates

`tsc --noEmit`, web lint, Vitest (47 files, 449 tests), root `format:check`, and
`git diff --check` passed. Lint has three existing warnings in the TOC and AI
explanation components. Focused lint of the changed capture script and cover
class also passed. No section files or scene behavior were changed.
