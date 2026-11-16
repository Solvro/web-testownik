import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

const native = requireOptionalNativeModule<{
  hideWebViewTopEdgeEffects: () => void;
}>("LibraryDrag");

/** Lets a web page under a transparent header show its own colour (iOS 26). */
export function hideWebViewTopEdgeEffects() {
  if (Platform.OS === "ios") native?.hideWebViewTopEdgeEffects();
}
