import type { StaticImageData } from "next/image";

import logoFullDarkAsset from "@/assets/logo-full-dark.svg";
import logoFullAsset from "@/assets/logo-full.svg";

/**
 * Next types SVG imports loosely, which otherwise forces an
 * `@typescript-eslint/no-unsafe-assignment` escape in every consumer. Narrowing
 * them once here keeps the components clean.
 */
export const wordmarkLight = logoFullAsset as StaticImageData;
export const wordmarkDark = logoFullDarkAsset as StaticImageData;
