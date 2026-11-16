import { expect, it, vi } from "vitest";
import JSZip from "jszip";
import { readZipEntry } from "../src/lib/bounded-zip";

function entry(chunks: string[]) {
  const listeners = new Map<string, (...args: string[]) => void>();
  let stopped = false;
  const stream = {
    on: vi.fn((event: string, callback: (...args: string[]) => void) => {
      listeners.set(event, callback);
      return stream;
    }),
    pause: vi.fn(() => {
      stopped = true;
      return stream;
    }),
    resume: vi.fn(() => {
      for (const chunk of chunks) {
        if (stopped) break;
        listeners.get("data")!(chunk);
      }
      if (!stopped) listeners.get("end")!();
      return stream;
    }),
  };
  const fullRead = vi.fn(() => {
    throw new Error("Unbounded accumulation must not run");
  });
  const file = {
    internalStream: vi.fn(() => stream),
    async: fullRead,
  } as unknown as JSZip.JSZipObject;
  return { file, stream, fullRead };
}

it("stops expanded text at its budget before reading the rest of a compressed entry", async () => {
  const item = entry(["a".repeat(6), "b".repeat(6), "c".repeat(100)]);
  await expect(
    readZipEntry(item.file, "string", 10, "Too large"),
  ).rejects.toThrow("Too large");
  expect(item.stream.pause).toHaveBeenCalledOnce();
  expect(item.fullRead).not.toHaveBeenCalled();
});

it("accounts for base64 expansion before accumulating an image", async () => {
  const item = entry(["abc", "def", "g"]);
  await expect(
    readZipEntry(item.file, "base64", 8, "Images too large"),
  ).rejects.toThrow("Images too large");
  expect(item.stream.pause).toHaveBeenCalledOnce();
  expect(item.fullRead).not.toHaveBeenCalled();
});

it("preserves exact budget boundaries, binary images, and Unicode text with real ZIP streams", async () => {
  const zip = new JSZip()
    .file("question.txt", "Żółć 🌍")
    .file("image.png", new Uint8Array([0, 128, 255, 12]));
  const loaded = await JSZip.loadAsync(
    await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" }),
  );
  expect(
    await readZipEntry(
      loaded.file("question.txt")!,
      "string",
      "Żółć 🌍".length,
      "Too large",
    ),
  ).toBe("Żółć 🌍");
  expect(
    await readZipEntry(loaded.file("image.png")!, "base64", 8, "Too large"),
  ).toBe("AID/DA==");
});
