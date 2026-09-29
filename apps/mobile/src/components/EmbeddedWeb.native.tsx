import { parseEmbeddedTheme } from "../lib/embed-theme";
import type { EmbeddedTheme } from "../lib/embed-theme";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  View,
  useColorScheme,
} from "react-native";
import WebView from "react-native-webview";

import { hideWebViewTopEdgeEffects } from "../../modules/library-drag/src/nativeChrome";
import { canNavigateEmbedded, embeddedPath } from "../lib/embed-navigation";
import { useLocale } from "../lib/locale";
import { WEB_URL } from "../lib/api";
import { ApiError } from "../lib/client";
import { useTheme } from "../lib/theme";
import { ErrorScreen } from "./ui";

export default function EmbeddedWeb({
  access,
  global = false,
  quizId,
  onRetry,
  onTheme,
  topInset,
  loadingBackground,
}: {
  access: string;
  global?: boolean;
  quizId?: string;
  onRetry: () => void;
  onTheme?: (theme: EmbeddedTheme) => void;
  /** Height of a transparent header drawn over the page; the page pads for it. */
  topInset?: number;
  /** Behind the spinner while the page loads, to match the page's own color. */
  loadingBackground?: string;
}) {
  // A load failure is a connection problem; an HTTP status is the server’s.
  const [failed, setFailed] = useState<Error | null>(null);
  const c = useTheme();
  const dark = useColorScheme() === "dark";
  const { t } = useLocale();
  const destination = embeddedPath({ quizId, global });
  const source = useMemo(
    () => ({
      uri: `${WEB_URL}/auth/mobile?${quizId ? `quiz=${encodeURIComponent(quizId)}` : `global=${global}`}`,
      headers: { Authorization: `Bearer ${access}` },
    }),
    [access, global, quizId],
  );
  if (failed)
    return (
      <ErrorScreen
        title={t("Nie udało się otworzyć", "Couldn’t Open This Page")}
        error={failed}
        retry={onRetry}
      />
    );
  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={source}
        // Without this the native default can leave scrolling without momentum.
        // 0.998 is UIKit's "normal"; the string crashes Android's native prop.
        decelerationRate={0.998}
        injectedJavaScriptBeforeContentLoaded={[
          topInset
            ? `document.documentElement.style.setProperty("--mobile-embed-top", "${Math.round(topInset)}px");`
            : "",
          // Statistics match the app's scheme and surfaces instead of the
          // web's own palette (Wrapped paints its slides itself).
          quizId
            ? `try { localStorage.setItem("theme", "${dark ? "dark" : "light"}"); } catch {}
              var style = document.documentElement.style;
              style.setProperty("--background", "${c.bg}");
              style.setProperty("--background-gradient-from", "${c.bg}");
              style.setProperty("--card", "${c.surface}");
              style.setProperty("--popover", "${c.surface}");`
            : "",
          "true;",
        ].join("\n")}
        contentInsetAdjustmentBehavior={topInset ? "never" : undefined}
        onLoadEnd={topInset ? hideWebViewTopEdgeEffects : undefined}
        onMessage={(event) => {
          if (
            !onTheme ||
            quizId ||
            !canNavigateEmbedded(event.nativeEvent.url, WEB_URL, destination)
          )
            return;
          const theme = parseEmbeddedTheme(event.nativeEvent.data);
          if (theme) onTheme(theme);
        }}
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        startInLoadingState
        renderLoading={() => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: loadingBackground ?? c.bg,
                justifyContent: "center",
              },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={loadingBackground ? "#ffffff" : undefined}
            />
          </View>
        )}
        onError={() => setFailed(new TypeError("Network request failed"))}
        onHttpError={(e) => {
          const status = e.nativeEvent.statusCode;
          if (status >= 400)
            setFailed(
              new ApiError(
                status,
                "",
                undefined,
                status === 503 ? "maintenance" : "operation",
              ),
            );
        }}
        onShouldStartLoadWithRequest={(request) => {
          if (canNavigateEmbedded(request.url, WEB_URL, destination))
            return true;
          try {
            const u = new URL(request.url);
            if (/^https?:$/.test(u.protocol)) void Linking.openURL(u.href);
          } catch {}
          return false;
        }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        style={{ flex: 1 }}
      />
    </View>
  );
}
