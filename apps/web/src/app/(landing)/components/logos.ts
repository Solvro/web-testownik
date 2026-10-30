import type { StaticImageData } from "next/image";

import logoFullDarkAsset from "@/assets/logo-full-dark.svg";
import logoFullAsset from "@/assets/logo-full.svg";
// Brand asset of UNIPERKS P.S.A., used with permission for the partner section
import uniperksWhiteAsset from "@/assets/partners/uniperks-white.svg";
// Brand asset of UNIPERKS P.S.A., used with permission for the partner section
import uniperksAsset from "@/assets/partners/uniperks.svg";

/**
 * Next types SVG imports loosely, which otherwise forces an
 * `@typescript-eslint/no-unsafe-assignment` escape in every consumer. Narrowing
 * them once here keeps the components clean.
 */
export const wordmarkLight = logoFullAsset as StaticImageData;
export const wordmarkDark = logoFullDarkAsset as StaticImageData;
export const uniperksWordmarkLight = uniperksAsset as StaticImageData;
export const uniperksWordmarkDark = uniperksWhiteAsset as StaticImageData;
