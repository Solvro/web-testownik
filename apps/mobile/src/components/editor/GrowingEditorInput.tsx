import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "../../lib/theme";

type Props = Omit<TextInputProps, "value" | "defaultValue" | "multiline"> & {
  text: string;
  minimumHeight?: number;
  inset?: number;
};

/** Key by entity. Measure native text separately so resizing never replaces UIKit's editing buffer. */
export default function GrowingEditorInput({
  text,
  minimumHeight = 44,
  inset = 10,
  style,
  ...props
}: Props) {
  const c = useTheme();
  const [initialText] = useState(text);
  const [height, setHeight] = useState(minimumHeight);
  const maximumHeight = Math.max(240, minimumHeight);
  return (
    <View>
      <Text
        accessible={false}
        aria-hidden
        pointerEvents="none"
        allowFontScaling={props.allowFontScaling}
        maxFontSizeMultiplier={props.maxFontSizeMultiplier}
        onLayout={(event) =>
          setHeight(
            Math.max(
              minimumHeight,
              Math.min(
                maximumHeight,
                Math.ceil(event.nativeEvent.layout.height) + inset * 2,
              ),
            ),
          )
        }
        style={{
          position: "absolute",
          top: inset,
          left: inset,
          right: inset,
          fontSize: 17,
          lineHeight: 22,
          opacity: 0,
        }}
      >
        {text || " "}
      </Text>
      <TextInput
        {...props}
        multiline
        defaultValue={initialText}
        scrollEnabled={height >= maximumHeight}
        placeholderTextColor={c.muted}
        style={[
          {
            color: c.text,
            fontSize: 17,
            lineHeight: 22,
            padding: inset,
            height,
            minHeight: minimumHeight,
            maxHeight: maximumHeight,
            textAlignVertical: "top",
          },
          style,
        ]}
      />
    </View>
  );
}
