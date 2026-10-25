/**
 * Offline export of the hero's device models.
 *
 *   pnpm export:device-models
 *
 * 1. Serves Apple's USDZ sources and three.js from a throwaway local server.
 * 2. Headless Chrome runs `prepare-scene.js`, which bakes the hero's fix-ups
 *    into the scene and exports it with GLTFExporter.
 * 3. glTF Transform deduplicates, prunes, welds, quantises and applies meshopt
 *    compression, then writes `public/models/device-stack.glb`. The three
 *    display meshes are exempt from every lossy step; see below.
 *
 * The output is deterministic: the same sources produce the same bytes.
 *
 * See `public/models/README.md` for where the sources come from.
 */
import { NodeIO } from "@gltf-transform/core";
import {
  ALL_EXTENSIONS,
  EXTMeshoptCompression,
} from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  quantize,
  reorder,
  weldPrimitive,
} from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

import { normalizeTexcoords } from "./normalize-texcoords.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "../..");
const sourceDirectory = path.resolve(
  process.env.DEVICE_MODELS_SOURCE ?? path.join(scriptDirectory, "source"),
);
const output = path.join(webRoot, "public/models/device-stack.glb");
const sources = ["macbook.usdz", "ipad.usdz", "iphone.usdz"];

const page = `<!doctype html>
<script type="importmap">
  {
    "imports": {
      "three": "/three/build/three.module.js",
      "three/addons/": "/three/examples/jsm/"
    }
  }
</script>
<script type="module" src="/prepare-scene.js"></script>`;

/** Maps a request path onto the one file it may serve, or null. */
function resolveRequest(pathname) {
  if (pathname === "/prepare-scene.js") {
    return path.join(scriptDirectory, "prepare-scene.js");
  }
  if (pathname.startsWith("/three/")) {
    const file = path.join(webRoot, "node_modules", pathname);
    return file.startsWith(path.join(webRoot, "node_modules/three/"))
      ? file
      : null;
  }
  const name = pathname.replace(/^\/source\//, "");
  return sources.includes(name) ? path.join(sourceDirectory, name) : null;
}

function startServer() {
  const server = createServer(async (request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname === "/") {
      response.setHeader("content-type", "text/html");
      response.end(page);
      return;
    }
    const file = resolveRequest(pathname);
    try {
      if (file === null) {
        throw new Error("not found");
      }
      const body = await readFile(file);
      response.setHeader(
        "content-type",
        file.endsWith(".js") ? "text/javascript" : "application/octet-stream",
      );
      response.end(body);
    } catch {
      response.statusCode = 404;
      response.end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(server);
    });
  });
}

async function exportFromUsdz() {
  for (const name of sources) {
    await stat(path.join(sourceDirectory, name)).catch(() => {
      throw new Error(
        `Missing ${name} in ${sourceDirectory}. See public/models/README.md.`,
      );
    });
  }

  const server = await startServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const browserPage = await browser.newPage();
    browserPage.on("pageerror", (error) => {
      console.error(error);
    });
    const { port } = server.address();
    await browserPage.goto(`http://127.0.0.1:${String(port)}/`);
    await browserPage.waitForFunction(() => "exportDeviceModels" in window);
    const base64 = await browserPage.evaluate(
      async () => await window.exportDeviceModels(),
    );
    return Buffer.from(base64, "base64");
  } finally {
    await browser.close();
    server.close();
  }
}

const DISPLAY_NODES = new Set([
  "laptop-display",
  "tablet-display",
  "phone-display",
]);

function listDisplayMeshes(document) {
  const displayMeshes = new Set(
    document
      .getRoot()
      .listNodes()
      .filter((node) => DISPLAY_NODES.has(node.getName()))
      .map((node) => node.getMesh()),
  );
  if (displayMeshes.size !== DISPLAY_NODES.size) {
    throw new Error("Expected exactly three named display meshes.");
  }
  return displayMeshes;
}

function listPrimitivesExceptDisplays(document) {
  const displayMeshes = listDisplayMeshes(document);
  return document
    .getRoot()
    .listMeshes()
    .filter((mesh) => !displayMeshes.has(mesh))
    .flatMap((mesh) => mesh.listPrimitives());
}

/**
 * USDLoader produces unindexed triangles, so welding is what makes the
 * geometry compressible at all. The three display meshes are left exactly as
 * authored: the hero measures each screen's plane, extent and in-plane axes as
 * averages over their vertices, and merging duplicates would re-weight those
 * averages — shifting the live UI by a fraction of a degree.
 */
function weldExceptDisplays(document) {
  for (const primitive of listPrimitivesExceptDisplays(document)) {
    weldPrimitive(primitive);
  }
}

/**
 * Quantises positions and UVs everywhere but on the displays, which stay
 * full-precision floats. glTF Transform cannot exclude meshes, so the
 * displays' attributes and node transforms are snapshotted and restored.
 */
async function quantizeExceptDisplays(document) {
  const snapshots = document
    .getRoot()
    .listNodes()
    .filter((node) => DISPLAY_NODES.has(node.getName()))
    .map((node) => ({
      node,
      matrix: node.getMatrix(),
      primitives: node
        .getMesh()
        .listPrimitives()
        .map((primitive) => ({
          primitive,
          attributes: primitive
            .listSemantics()
            .map((semantic) => [semantic, primitive.getAttribute(semantic)]),
        })),
    }));

  // Positions at 14 bits, UVs at 12: glTF Transform's defaults.
  await document.transform(
    quantize({ pattern: /^(POSITION|TEXCOORD_0)$/, cleanup: false }),
  );

  for (const { node, matrix, primitives } of snapshots) {
    node.setMatrix(matrix);
    for (const { primitive, attributes } of primitives) {
      for (const [semantic, accessor] of attributes) {
        primitive.setAttribute(semantic, accessor);
      }
    }
  }
}

/**
 * Stores normals as 8-bit snorm everywhere but on the displays, whose vertex
 * normals the hero averages to find each screen's facing direction. 8-bit
 * normals tilted the MacBook's live UI by about 0.3°.
 */
function quantizeNormalsExceptDisplays(document) {
  for (const primitive of listPrimitivesExceptDisplays(document)) {
    const source = primitive.getAttribute("NORMAL");
    if (source === null) {
      continue;
    }
    const quantized = Int8Array.from(source.getArray(), (value) =>
      Math.round(Math.max(-1, Math.min(1, value)) * 127),
    );
    primitive.setAttribute(
      "NORMAL",
      source.clone().setArray(quantized).setNormalized(true),
    );
  }
}

const kilobytes = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

const raw = await exportFromUsdz();

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const document = await io.readBinary(new Uint8Array(raw));
await document.transform(
  dedup(),
  // Keep attributes: the displays carry UVs no material samples, which the
  // hero uses to find each screen's in-plane axes.
  prune({ keepAttributes: true }),
  weldExceptDisplays,
  normalizeTexcoords,
  dedup(),
  reorder({ encoder: MeshoptEncoder, target: "size" }),
  quantizeExceptDisplays,
  quantizeNormalsExceptDisplays,
  prune({ keepAttributes: true }),
);
document
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({
    method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
  });
const glb = await io.writeBinary(document);
await writeFile(output, glb);

let sourceBytes = 0;
for (const name of sources) {
  const { size } = await stat(path.join(sourceDirectory, name));
  sourceBytes += size;
}
console.log(
  `USDZ sources ${kilobytes(sourceBytes)} → GLTFExporter ${kilobytes(raw.length)} → ${path.relative(webRoot, output)} ${kilobytes(glb.byteLength)}`,
);
