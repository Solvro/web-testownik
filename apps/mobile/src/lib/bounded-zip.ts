import JSZip from "jszip";

type Entry = JSZip.JSZipObject & {
  // Documented by JSZip, but omitted from its JSZipObject declaration.
  internalStream(
    type: "string" | "binarystring",
  ): JSZip.JSZipStreamHelper<string>;
};

/** Stop inflation before accumulating an entry beyond the remaining budget. */
export async function readZipEntry(
  file: JSZip.JSZipObject,
  type: "string" | "base64",
  limit: number,
  message: string,
): Promise<string> {
  const stream = (file as Entry).internalStream(
    type === "string" ? "string" : "binarystring",
  );
  const chunks: string[] = [];
  let size = 0;
  let settled = false;
  const contents = await new Promise<string>((resolve, reject) => {
    stream
      .on("data", (chunk) => {
        if (settled) return;
        size += chunk.length;
        const outputSize = type === "base64" ? 4 * Math.ceil(size / 3) : size;
        if (outputSize > limit) {
          settled = true;
          chunks.length = 0;
          stream.pause();
          reject(new Error(message));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", (error) => {
        if (settled) return;
        settled = true;
        chunks.length = 0;
        reject(error);
      })
      .on("end", () => {
        if (settled) return;
        settled = true;
        resolve(chunks.join(""));
        chunks.length = 0;
      })
      .resume();
  });
  if (type === "string") return contents;
  // This entry is already bounded and uncompressed. Reuse JSZip's portable
  // base64 conversion rather than relying on platform-specific globals.
  return new JSZip()
    .file("image", contents, { binary: true })
    .file("image")!
    .async("base64");
}
