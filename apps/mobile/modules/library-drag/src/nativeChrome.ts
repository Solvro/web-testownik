import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

const native = requireOptionalNativeModule<{
  hideWebViewTopEdgeEffects: () => void;
}>("LibraryDrag");

/** Lets a web page under a transparent header show its own colour (iOS 26). */
export function hideWebViewTopEdgeEffects() {
  if (Platform.OS === "ios") native?.hideWebViewTopEdgeEffects();
}

const titles = requireOptionalNativeModule<{
  setNavigationTitleImage: (
    title: string,
    image: string,
    height: number,
    largeHeight: number,
    lift: number,
  ) => void;
}>("LibraryDrag");

/** Puts an image from the asset catalog in place of a screen's native title. */
export function setNavigationTitleImage(
  title: string,
  image: string,
  height: number,
  largeHeight = 0,
  lift = 0,
) {
  if (Platform.OS === "ios")
    titles?.setNavigationTitleImage(title, image, height, largeHeight, lift);
}
