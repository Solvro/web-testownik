import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import { useLocale } from "../lib/locale";
import type { ImageApproval } from "../lib/image-policy";
import { richHtml } from "../lib/rich-html";
import { useTheme } from "../lib/theme";
import { useSession } from "../lib/session";

export default function RichText({
  text,
  allowImages = false,
  size = 17,
  passiveImages = false,
  retryGeneration = 0,
  onImageFailure,
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
    ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () =>
      richHtml(
        text,
        c.text,
        allowImages,
        fontScale,
        size,
        hiddenImageLabel,
        undefined,
        {
          failed: imageFailureLabel,
          retry: passiveImages ? null : retryImageLabel,
          generation,
        },
      ) + `<!--image-attempt:${imageAttempt + generation}-->`,
    [
      text,
      c.text,
      allowImages,
      fontScale,
      size,
      hiddenImageLabel,
      imageFailureLabel,
      retryImageLabel,
      imageAttempt,
      passiveImages,
      generation,
    ],
  );
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      if (e.data?.testownikImageFailed === generation) {
        onImageFailure?.();
        return;
      }
      if (e.data?.testownikRetryImage === true) {
        if (passiveImages) return;
        setImageAttempt((attempt) => attempt + 1);
        return;
      }
      const n = Number(e.data?.testownikHeight);
      if (Number.isFinite(n)) setHeight(Math.min(15000, Math.max(32, n)));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [generation, onImageFailure, passiveImages]);
  return (
    <iframe
      ref={ref}
      title={t("Treść pytania", "Question content")}
      sandbox="allow-scripts allow-popups"
      srcDoc={html}
      style={{ border: 0, width: "100%", height, background: "transparent" }}
    />
  );
}
