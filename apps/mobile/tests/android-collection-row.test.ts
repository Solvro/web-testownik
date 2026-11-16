import { expect, it, vi } from "vitest";
import CollectionRow from "../src/components/native/CollectionRow.android";

vi.mock("react-native", () => ({
  Pressable: "NativeButton",
  View: "NativeView",
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: "Icon" }));
vi.mock("@expo/ui/jetpack-compose", () => ({
  Icon: "MaterialIcon",
  RNHostView: "HostView",
  Text: "MaterialText",
  ListItem: Object.assign(() => null, {
    HeadlineContent: "Headline",
    SupportingContent: "Supporting",
    LeadingContent: "Leading",
  }),
}));
vi.mock("../src/components/native/M3Host", () => ({ default: "MaterialHost" }));
vi.mock("../src/components/native/materialIcons.android", () => ({
  symbolForIonicon: () => null,
}));
vi.mock("../src/lib/theme", () => ({
  useTheme: () => ({
    surface: "white",
    text: "black",
    muted: "gray",
    fill: "silver",
  }),
}));

it("exposes the caller's action label and supporting hint on one native button", () => {
  const onPress = vi.fn();
  const row = CollectionRow({
    title: "Ada",
    detail: "ada@example.org",
    accessibilityLabel: "Add Ada",
    onPress,
  });
  expect(row.props.accessibilityRole).toBe("button");
  expect(row.props.accessibilityLabel).toBe("Add Ada");
  expect(row.props.accessibilityHint).toBe("ada@example.org");
  expect(row.props.accessibilityState).toEqual({ disabled: false });
  expect(row.props.style.minHeight).toBeGreaterThanOrEqual(48);
  row.props.onPress();
  expect(onPress).toHaveBeenCalledTimes(1);
  const child = row.props.children;
  expect(child.props.importantForAccessibility).toBe("no-hide-descendants");
  const listItem = child.props.children.props.children;
  expect(listItem.props.modifiers).toBeUndefined();
});

it("gives disabled rows disabled native semantics while retaining their title", () => {
  const row = CollectionRow({
    title: "Already shared",
    onPress: vi.fn(),
    disabled: true,
  });
  expect(row.props.accessibilityLabel).toBe("Already shared");
  expect(row.props.disabled).toBe(true);
  expect(row.props.accessibilityState).toEqual({ disabled: true });
  expect(row.props.style.opacity).toBeLessThan(1);
});
