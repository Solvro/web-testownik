import {
  Column,
  ModalBottomSheet,
  RNHostView,
  Text,
  type ModalBottomSheetRef,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useRef, type ReactNode } from "react";
import { ScrollView, useWindowDimensions } from "react-native";

import { useTheme } from "../../lib/theme";
import M3Host from "../native/M3Host";

/**
 * Material 3 modal bottom sheet: drag handle, 28dp top corners, scrim, and
 * swipe / back / outside-tap dismissal. React Native content scrolls inside.
 */
export default function GradeSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const sheet = useRef<ModalBottomSheetRef>(null);
  const { height: screen } = useWindowDimensions();
  return (
    <M3Host matchContents style={{ position: "absolute" }}>
      <ModalBottomSheet
        ref={sheet}
        onDismissRequest={onClose}
        containerColor={c.bg}
      >
        <Column modifiers={[fillMaxWidth(), height(screen * 0.8)]}>
          <Text
            style={{ typography: "titleLarge" }}
            modifiers={[padding(16, 0, 16, 8)]}
          >
            {title}
          </Text>
          <RNHostView modifiers={[fillMaxWidth(), weight(1)]}>
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 32,
                gap: 16,
              }}
            >
              {children}
            </ScrollView>
          </RNHostView>
        </Column>
      </ModalBottomSheet>
    </M3Host>
  );
}
