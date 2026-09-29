import { useEffect, useMemo, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";

import { useLocale } from "../lib/locale";
import type { ImageApproval } from "../lib/image-policy";
import { richHtml } from "../lib/rich-html";
import { useTheme } from "../lib/theme";

export default function RichText({
  text,
  allowImages = false,
  size = 17,
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
    [height, setHeight] = useState(50),
    ref = useRef<HTMLIFrameElement>(null);
  const html = useMemo(
    () =>
      richHtml(text, c.text, allowImages, fontScale, size, hiddenImageLabel),
    [text, c.text, allowImages, fontScale, size, hiddenImageLabel],
  );
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const n = Number(e.data?.testownikHeight);
      if (Number.isFinite(n)) setHeight(Math.min(15000, Math.max(32, n)));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
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
