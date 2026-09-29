import { Ionicons } from "@expo/vector-icons";
import {
  Button,
  Column,
  FilledTonalButton,
  FlowRow,
  Icon,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  padding,
  testID as testTag,
} from "@expo/ui/jetpack-compose/modifiers";
import { ScrollView } from "react-native";

import { useTheme } from "../../lib/theme";
import M3Host from "./M3Host";
import { symbolForIonicon } from "./materialIcons.android";
import type { StatusAction, StatusViewProps } from "./StatusView.types";

export type { StatusAction, StatusViewProps } from "./StatusView.types";

// Material 3 empty / error state: a 48dp icon in onSurfaceVariant, a
// headlineSmall title, bodyMedium supporting text and the actions below.
// Emphasis follows M3: a `primary` action is a filled button; without one
// the first action is tonal and the rest are text buttons. The RN scroll view
// keeps the whole thing reachable at large font scales.
export default function StatusView({ testID, ...props }: StatusViewProps) {
  const c = useTheme();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 32,
      }}
    >
      <StatusContent {...props} />
    </ScrollView>
  );
}

/** The same message without its own scroll view, for inside a list. */
export function StatusContent({
  ionicon,
  title,
  description,
  actions = [],
}: Omit<StatusViewProps, "testID" | "symbol">) {
  const c = useTheme();
  const source = symbolForIonicon(ionicon);
  const hasPrimary = actions.some((action) => action.primary);
  const Control = (action: StatusAction, index: number) =>
    action.primary
      ? Button
      : !hasPrimary && index === 0
        ? FilledTonalButton
        : TextButton;
  return (
    <>
      {source ? null : (
        <Ionicons
          name={ionicon}
          size={48}
          color={c.muted}
          style={{ marginBottom: 16, alignSelf: "center" }}
        />
      )}
      <M3Host
        matchContents={{ vertical: true }}
        style={{ width: "100%", maxWidth: 480, alignSelf: "center" }}
      >
        <Column
          horizontalAlignment="center"
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth()]}
        >
          {source ? (
            <Icon
              source={source}
              size={48}
              tint={c.muted}
              modifiers={[padding(0, 0, 0, 8)]}
            />
          ) : null}
          <Text
            color={c.text}
            style={{ typography: "headlineSmall", textAlign: "center" }}
          >
            {title}
          </Text>
          {description ? (
            <Text
              color={c.muted}
              style={{ typography: "bodyMedium", textAlign: "center" }}
            >
              {description}
            </Text>
          ) : null}
          {actions.length ? (
            <FlowRow
              horizontalArrangement={{ spacedBy: 8 }}
              verticalArrangement={{ spacedBy: 8 }}
              modifiers={[padding(0, 16, 0, 0)]}
            >
              {actions.map((action, index) => {
                const Action = Control(action, index);
                return (
                  <Action
                    key={action.label}
                    onClick={action.onPress}
                    modifiers={[testTag(`status-action-${index}`)]}
                  >
                    <Text>{action.label}</Text>
                  </Action>
                );
              })}
            </FlowRow>
          ) : null}
        </Column>
      </M3Host>
    </>
  );
}
