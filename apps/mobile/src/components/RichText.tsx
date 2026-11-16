import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import Markdown from "react-native-markdown-display";
import WebView from "react-native-webview";

import { useLocale } from "../lib/locale";
import type { ImageApproval } from "../lib/image-policy";
import { richHtml } from "../lib/rich-html";
import { offlineImageData } from "../lib/offline-images";
import {
  allowRichTextNavigation,
  openRichTextLink,
} from "../lib/rich-text-link";
import { useTheme } from "../lib/theme";
import { useSession } from "../lib/session";
import { Button } from "./ui";

export default function RichText({
  text,
  allowImages = false,
  size = 17,
  passiveImages = false,
  retryGeneration = 0,
  onImageFailure,
  documentGeneration = 0,
  onDocumentFailure,
  nativeMarkdown = false,
}: {
  text: string;
  allowImages?: ImageApproval;
  size?: number;
  nativeMarkdown?: boolean;
  passiveImages?: boolean;
  retryGeneration?: number;
  onImageFailure?: () => void;
  documentGeneration?: number;
  onDocumentFailure?: () => void;
}) {
  const { t } = useLocale();
  const { offline } = useSession();
  const imageFailureLabel =
    offline && /!\[/.test(text)
      ? t(
          "Ten obraz nie jest zapisany na urządzeniu. Połącz się z internetem, aby go pobrać.",
          "This image is not saved on this device. Connect to the internet to download it.",
        )
      : t("Nie udało się wczytać obrazu.", "The image could not be loaded.");
  const generation = /!\[/.test(text) ? retryGeneration : 0;
  const retryImageLabel = t("Spróbuj ponownie", "Try Again");
  const hiddenImageLabel = t(
    "Obraz zewnętrzny ukryty",
    "External image hidden",
  );
  const { fontScale } = useWindowDimensions();
  const c = useTheme(),
    [height, setHeight] = useState(50),
    [imageAttempt, setImageAttempt] = useState(0),
    [documentAttempt, setDocumentAttempt] = useState(0),
    [documentFailure, setDocumentFailure] = useState<{
      text: string;
      generation: number;
      attempt: number;
    } | null>(null);
  const formatted = /[$*_`#\[\]<>~|\\]|^\s*[-+>]\s|^\s*\d+[.)]\s/m.test(text);
  const html = useMemo(
    () =>
      formatted && !nativeMarkdown
        ? richHtml(
            text,
            c.text,
            allowImages,
            fontScale,
            size,
            hiddenImageLabel,
            offlineImageData,
            {
              failed: imageFailureLabel,
              retry: passiveImages ? null : retryImageLabel,
              generation,
            },
          ) + `<!--image-attempt:${imageAttempt + generation}-->`
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
      imageFailureLabel,
      retryImageLabel,
      imageAttempt,
      passiveImages,
      generation,
    ],
  );
  const activeDocument = useRef({
    text,
    html,
    generation: documentGeneration,
    attempt: documentAttempt,
  });
  const failedDocument = useRef<typeof documentFailure>(null);
  useLayoutEffect(() => {
    const identity = {
      text,
      html,
      generation: documentGeneration,
      attempt: documentAttempt,
    };
    activeDocument.current = identity;
    if (
      failedDocument.current &&
      (failedDocument.current.text !== text ||
        failedDocument.current.generation !== documentGeneration ||
        failedDocument.current.attempt !== documentAttempt)
    )
      failedDocument.current = null;
    return () => {
      if (activeDocument.current === identity)
        activeDocument.current = {
          text: "",
          html: null,
          generation: -1,
          attempt: -1,
        };
    };
  }, [text, html, documentGeneration, documentAttempt]);
  const sameDocument = (identity: typeof documentFailure) =>
    identity !== null &&
    identity.text === text &&
    identity.generation === documentGeneration &&
    identity.attempt === documentAttempt;
  if (documentFailure && !sameDocument(documentFailure))
    setDocumentFailure(null);
  const failDocument = () => {
    if (
      !sameDocument(activeDocument.current) ||
      activeDocument.current.html !== html ||
      sameDocument(failedDocument.current)
    )
      return;
    const failure = {
      text,
      generation: documentGeneration,
      attempt: documentAttempt,
    };
    failedDocument.current = failure;
    setDocumentFailure(failure);
    onDocumentFailure?.();
  };
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
          void openRichTextLink(url, t);
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
  if (sameDocument(documentFailure)) {
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: c.text, fontSize: size, lineHeight: size * 1.4 }}>
          {text}
        </Text>
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: c.muted }}
        >
          {t(
            "Nie udało się wyświetlić formatowania. Treść jest dostępna jako tekst.",
            "Formatting could not be displayed. The content is available as text.",
          )}
        </Text>
        {onDocumentFailure ? null : (
          <Button
            kind="secondary"
            onPress={() => {
              setDocumentFailure(null);
              setDocumentAttempt((attempt) => attempt + 1);
            }}
          >
            {t("Wczytaj ponownie treść", "Reload Content")}
          </Button>
        )}
      </View>
    );
  }
  return (
    <View style={{ minHeight: 32, height }}>
      <WebView
        key={`${documentGeneration}:${documentAttempt}`}
        onContentProcessDidTerminate={failDocument}
        onRenderProcessGone={failDocument}
        source={{ html: html ?? "" }}
        // Keep every navigation in our handler. WebView opens nonwhitelisted
        // schemes itself, bypassing the HTTP-only policy and failure feedback.
        originWhitelist={["*"]}
        style={{ backgroundColor: "transparent" }}
        scrollEnabled={false}
        onMessage={(e) => {
          if (e.nativeEvent.data === `testownik:image-failed:${generation}`) {
            onImageFailure?.();
            return;
          }
          if (e.nativeEvent.data === "testownik:retry-image") {
            if (passiveImages) return;
            setImageAttempt((attempt) => attempt + 1);
            return;
          }
          const n = Number(e.nativeEvent.data);
          if (Number.isFinite(n)) setHeight(Math.min(15000, Math.max(32, n)));
        }}
        onShouldStartLoadWithRequest={(r) => allowRichTextNavigation(r.url, t)}
      />
    </View>
  );
}
