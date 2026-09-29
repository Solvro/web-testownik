import { fill } from "../quiz-list/QuizRow";
import { userError, failureTitle } from "../../lib/user-error";
import { Button, Host, HStack, Image, Text, VStack } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  contentShape,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  shapes,
} from "@expo/ui/swift-ui/modifiers";

import { useWindowDimensions } from "react-native";
import { useLocale } from "../../lib/locale";
import { notify } from "../../lib/alerts";
import { useTheme } from "../../lib/theme";

export default function NativeRow({
  title,
  detail,
  onPress,
}: {
  title: string;
  detail?: string;
  onPress?: () => void | Promise<void>;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const { fontScale } = useWindowDimensions();
  const content = (
    <HStack
      modifiers={[
        frame({ maxWidth: Infinity, minHeight: 48, alignment: "leading" }),
        padding({ vertical: 8 }),
        contentShape(shapes.rectangle()),
      ]}
    >
      <VStack
        alignment="leading"
        spacing={3}
        modifiers={[fill, fixedSize({ horizontal: false, vertical: true })]}
      >
        <Text
          modifiers={[
            font({ textStyle: "body" }),
            ...(fontScale > 1.3 ? [] : [lineLimit(2)]),
            foregroundStyle({ type: "color", color: c.text }),
          ]}
        >
          {title}
        </Text>
        {detail ? (
          <Text
            modifiers={[
              font({ textStyle: "subheadline" }),
              ...(fontScale > 1.3 ? [] : [lineLimit(2)]),
              foregroundStyle({ type: "color", color: c.muted }),
            ]}
          >
            {detail}
          </Text>
        ) : null}
      </VStack>
      {onPress ? (
        <Image systemName="chevron.right" size={12} color={c.muted} />
      ) : null}
    </HStack>
  );
  return (
    <Host
      matchContents={{ vertical: true }}
      ignoreSafeArea="all"
      style={{ width: "100%" }}
    >
      {onPress ? (
        <Button
          modifiers={[buttonStyle("plain")]}
          onPress={() => {
            void Promise.resolve()
              .then(onPress)
              .catch((e) => notify(failureTitle(t), userError(e, t)));
          }}
        >
          {content}
        </Button>
      ) : (
        content
      )}
    </Host>
  );
}
