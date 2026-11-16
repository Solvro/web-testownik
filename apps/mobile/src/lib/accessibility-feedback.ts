import { AccessibilityInfo, Platform } from "react-native";

/** One completion per request; callers invoke this only after validating a result. */
export function createCompletionAnnouncement(signal?: AbortSignal) {
  let announced = false;
  return (message: string) => {
    if (announced || signal?.aborted || !message.trim()) return;
    if (Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, {
        queue: true,
      });
    } else if (Platform.OS === "android") {
      AccessibilityInfo.announceForAccessibility(message);
    } else return;
    announced = true;
  };
}
