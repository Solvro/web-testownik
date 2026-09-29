import { useMemo, useState } from "react";
import { Linking, Text, View, useWindowDimensions } from "react-native";
import Markdown from "react-native-markdown-display";
import WebView from "react-native-webview";

import { useLocale } from "../lib/locale";
import type { ImageApproval } from "../lib/image-policy";
import { richHtml } from "../lib/rich-html";
import { useTheme } from "../lib/theme";

export default function RichText({
  text,
  allowImages = false,
  size = 17,
  nativeMarkdown = false,
}: {
  text: string;
  allowImages?: ImageApproval;
  size?: number;
  nativeMarkdown?: boolean;
}) {
  const { t } = useLocale();
  const hiddenImageLabel = t(
    "Obraz zewnętrzny ukryty",
    "External image hidden",
  );
  const { fontScale } = useWindowDimensions();
  const c = useTheme(),
    [height, setHeight] = useState(50);
  const formatted = /[$*_`#\[\]<>~|\\]|^\s*[-+>]\s|^\s*\d+[.)]\s/m.test(text);
  const html = useMemo(
    () =>
      formatted && !nativeMarkdown
        ? richHtml(text, c.text, allowImages, fontScale, size, hiddenImageLabel)
        : null,
    [
      text,
      c.text,
      allowImages,
      fontScale,
      size,
      hiddenImageLabel,
      formatted,
      nativeMarkdown,
    ],
  );
  // Most answers are plain text. A native Text avoids creating an entire web
  // process for each row and participates in Dynamic Type and accessibility.
  if (!formatted) {
    return (
      <Text style={{ color: c.text, fontSize: size, lineHeight: size * 1.4 }}>
        {text}
      </Text>
    );
  }
  // Ordinary Markdown streams directly into native text rather than reloading
  // a WebView for every token. Keep the web renderer for math and media.
  if (nativeMarkdown) {
    return (
      <Markdown
        rules={{
          image: (node) => (
            <Text key={node.key} style={{ color: c.muted }}>
              {hiddenImageLabel}
            </Text>
          ),
        }}
        onLinkPress={(url) => {
          if (/^https?:\/\//.test(url)) void Linking.openURL(url);
          return false;
        }}
        style={{
          body: { color: c.text, fontSize: size, lineHeight: size * 1.4 },
          code_inline: { color: c.text, backgroundColor: c.surface },
          code_block: { color: c.text, backgroundColor: c.surface },
          fence: { color: c.text, backgroundColor: c.surface },
        }}
      >
        {text}
      </Markdown>
    );
  }
  return (
    <View style={{ minHeight: 32, height }}>
      <WebView
        source={{ html: html ?? "" }}
        originWhitelist={["about:*"]}
        style={{ backgroundColor: "transparent" }}
        scrollEnabled={false}
        onMessage={(e) => {
          const n = Number(e.nativeEvent.data);
          if (Number.isFinite(n)) setHeight(Math.min(15000, Math.max(32, n)));
        }}
        onShouldStartLoadWithRequest={(r) => {
          if (r.url === "about:blank") return true;
          if (/^https?:\/\//.test(r.url)) void Linking.openURL(r.url);
          return false;
        }}
      />
    </View>
  );
}
