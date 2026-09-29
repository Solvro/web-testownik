import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// One haptic per action, fired together with its visual change and never as the
// only feedback. Web and unsupported devices silently skip it.
const enabled = Platform.OS === "ios" || Platform.OS === "android";

function run(effect: () => Promise<void>) {
  if (enabled) void effect().catch(() => undefined);
}

export const haptics = {
  /** A value or selection changed (toggling an answer, picking a segment). */
  selection: () => run(Haptics.selectionAsync),
  /** Something committed or snapped into place. */
  commit: () =>
    run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  success: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    ),
  warning: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    ),
  error: () =>
    run(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    ),
};
