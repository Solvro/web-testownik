import { expect, it } from "vitest";
import { ownedImageName } from "../src/lib/image-cache-policy";
const hash = "a".repeat(64);
it.each([
  `${hash}.png`,
  `${hash}.PNG`,
  `${hash}.JpG`,
  "f000b6a3-42.png",
  "0-123.img",
])("recognizes an app-owned complete image: %s", (name) => {
  expect(ownedImageName(name)).toEqual({
    base: name.toLowerCase(),
    partial: false,
  });
});
it.each([`${hash}.png.1.partial`, "f000b6a3-42.png.partial"])(
  "recognizes actual current and legacy temporary filename formats: %s",
  (name) => {
    expect(ownedImageName(name)?.partial).toBe(true);
  },
);
it.each([
  "unknown.png",
  `${hash}.txt`,
  `${hash.toUpperCase()}.png`,
  `${hash}.png.partial`,
  `${hash}.png.0.partial`,
  "f000b6a3-0.png",
  "f000b6a3-4294967296.png",
  "00-42.png",
  `nested/${hash}.png`,
  `../${hash}.png`,
])("keeps unknown or outside formats: %s", (name) => {
  expect(ownedImageName(name)).toBeNull();
});
