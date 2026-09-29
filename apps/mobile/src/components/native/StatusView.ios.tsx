import {
  Button,
  ContentUnavailableView,
  HStack,
  Host,
  VStack,
} from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  fixedSize,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";

import { useTheme } from "../../lib/theme";
import type { StatusViewProps } from "./StatusView.types";

export type { StatusAction, StatusViewProps } from "./StatusView.types";

// SwiftUI's ContentUnavailableView, as in Mail, Notes and Files, with its
// actions underneath like the system's own `actions:` slot.
export default function StatusView({ testID, ...props }: StatusViewProps) {
  const c = useTheme();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: c.bg }}>
      <Host style={{ flex: 1 }}>
        <StatusStack {...props} />
      </Host>
    </View>
  );
}

/** The same message sized to its content, for inside a list. */
export function StatusContent(props: Omit<StatusViewProps, "testID">) {
  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <StatusStack {...props} />
    </Host>
  );
}

function StatusStack({
  symbol,
  title,
  description,
  actions = [],
}: Omit<StatusViewProps, "testID">) {
  const c = useTheme();
  return (
    <VStack spacing={0}>
      <ContentUnavailableView
        title={title}
        systemImage={symbol}
        description={description}
        modifiers={[fixedSize({ horizontal: false, vertical: true })]}
      />
      {actions.length ? (
        <HStack spacing={12}>
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              onPress={action.onPress}
              modifiers={[
                buttonStyle(action.primary ? "borderedProminent" : "bordered"),
                controlSize("regular"),
                tint(c.primary),
              ]}
            />
          ))}
        </HStack>
      ) : null}
    </VStack>
  );
}
