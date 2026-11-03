import type { StaticImageData } from "next/image";

import logoFullDarkAsset from "@/assets/logo-full-dark.svg";
import logoFullAsset from "@/assets/logo-full.svg";
// Brand asset of UNIPERKS P.S.A., used with permission for the partner section
import uniperksWhiteAsset from "@/assets/partners/uniperks-white.svg";
// Brand asset of UNIPERKS P.S.A., used with permission for the partner section
import uniperksAsset from "@/assets/partners/uniperks.svg";

/** Next types SVG imports loosely; narrowed once here instead of in every consumer. */
export const wordmarkLight = logoFullAsset as StaticImageData;
export const wordmarkDark = logoFullDarkAsset as StaticImageData;
export const uniperksWordmarkLight = uniperksAsset as StaticImageData;
export const uniperksWordmarkDark = uniperksWhiteAsset as StaticImageData;
