import { Button, Host, HStack, Image } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  buttonStyle,
  contentShape,
  frame,
  shapes,
} from "@expo/ui/swift-ui/modifiers";
import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import type { RatingControlProps } from "./RatingControl";

export default function RatingControl({ value, onChange }: RatingControlProps) {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <Host
      ignoreSafeArea="all"
      matchContents={{ vertical: true }}
      style={{ width: "100%" }}
    >
      <HStack spacing={4} modifiers={[frame({ maxWidth: Infinity })]}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Button
            key={score}
            onPress={() => onChange(score)}
            modifiers={[
              buttonStyle("plain"),
              accessibilityLabel(
                t(`Ocena ${score} z 5`, `Rate ${score} out of 5`),
              ),
              ...(value === score
                ? [accessibilityAddTraits(["isSelected"])]
                : []),
            ]}
          >
            <Image
              systemName={score <= value ? "star.fill" : "star"}
              size={28}
              color={c.caution}
              modifiers={[
                frame({ width: 48, height: 48 }),
                contentShape(shapes.rectangle()),
              ]}
            />
          </Button>
        ))}
      </HStack>
    </Host>
  );
}
