import { useQuery } from "@tanstack/react-query";
import { Platform, View, useColorScheme } from "react-native";
import { useLocale } from "../src/lib/locale";
import type { EmbeddedTheme } from "../src/lib/embed-theme";
import { Stack, router, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import EmbeddedWeb from "../src/components/EmbeddedWeb";
import Overflow from "../src/components/Overflow";
import { ErrorScreen, Loading } from "../src/components/ui";
import { api } from "../src/lib/api";
import { tokenStore } from "../src/lib/storage";
import { useSession } from "../src/lib/session";
import { useTheme } from "../src/lib/theme";

export default function Wrapped() {
  const { t } = useLocale();
  const c = useTheme();
  const scheme = useColorScheme();
  const focused = useIsFocused();
  const [slide, setTheme] = useState<EmbeddedTheme>({
    background: "#15171c",
    foreground: "#ffffff",
    dark: true,
  });
  const insets = useSafeAreaInsets();
  const s = useSession(),
    [global, setGlobal] = useState(false),
    [generation, setGeneration] = useState(0);
  const owner = tokenStore.session();
  const client = useMemo(() => api.forSession(owner), [owner]);
  const q = useQuery({
    queryKey: ["embedded-wrapped", s.user?.id, generation],
    queryFn: () => client.post<{ access: string }>("mobile/auth/web-session/"),
    enabled: !!s.user,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  // Until the page is on its way (loading, errors), the chrome matches the app.
  const theme: EmbeddedTheme = q.data
    ? slide
    : { background: c.bg, foreground: c.text, dark: scheme === "dark" };
  const toggleSummary = () => {
    setGlobal((v) => !v);
    setGeneration((v) => v + 1);
    setTheme({ background: "#15171c", foreground: "#ffffff", dark: true });
  };
  const actionLabel = global
    ? t("Moje podsumowanie", "My Summary")
    : t("Cała społeczność", "Community");
  return (
    <>
      {/* Only while visible: a screen pushed on top keeps its own style. */}
      {focused ? <StatusBar style={theme.dark ? "light" : "dark"} /> : null}
      <Stack.Screen
        options={{
          title: "Wrapped",
          // On iOS the page runs up behind the see-through header, so the
          // header area fades with the slide's own CSS transition.
          headerTransparent: Platform.OS === "ios",
          headerStyle:
            Platform.OS === "ios"
              ? undefined
              : { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
          // UIKit keeps the system back chevron's first tint, so iOS uses a
          // toolbar button that is re-created when the slide colors change.
          headerBackVisible: Platform.OS !== "ios",
          headerRight:
            Platform.OS === "ios"
              ? undefined
              : () => (
                  <Overflow
                    label={t("Opcje Wrapped", "Wrapped options")}
                    items={[{ title: actionLabel, onPress: toggleSummary }]}
                  />
                ),
        }}
      />
      {Platform.OS === "ios" ? (
        // Native glass items; the tint follows the current slide's colors.
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            key={theme.foreground}
            icon="chevron.left"
            tintColor={theme.foreground}
            onPress={() => router.back()}
          >
            {t("Wstecz", "Back")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      {Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Menu
            key={theme.foreground}
            icon="ellipsis"
            tintColor={theme.foreground}
            accessibilityLabel={t("Opcje Wrapped", "Wrapped options")}
          >
            <Stack.Toolbar.MenuAction
              icon={global ? "person" : "person.3"}
              onPress={toggleSummary}
            >
              {actionLabel}
            </Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      ) : null}
      <View style={{ flex: 1 }}>
        {q.error ? (
          <ErrorScreen
            error={q.error}
            retry={() => setGeneration((v) => v + 1)}
          />
        ) : q.data ? (
          <EmbeddedWeb
            key={`${s.user?.id}-${global}-${generation}`}
            access={q.data.access}
            loadingBackground={slide.background}
            onTheme={setTheme}
            global={global}
            onRetry={() => {
              setGeneration((v) => v + 1);
              setTheme({
                background: "#15171c",
                foreground: "#ffffff",
                dark: true,
              });
            }}
            topInset={
              Platform.OS === "ios" ? insets.top + NAV_BAR_HEIGHT : undefined
            }
          />
        ) : (
          <Loading />
        )}
      </View>
    </>
  );
}

// iOS 26 navigation bar height below the status bar.
const NAV_BAR_HEIGHT = 54;
