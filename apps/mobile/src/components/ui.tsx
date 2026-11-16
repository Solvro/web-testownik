import { router } from "expo-router";
import { HeaderHeightContext } from "expo-router/react-navigation";
import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import {
  KeyboardAvoidingView,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLocale } from "../lib/locale";
import { notify } from "../lib/alerts";
import {
  type ErrorKind,
  errorKind,
  userError,
  failureTitle,
} from "../lib/user-error";
import { useTheme } from "../lib/theme";
import ActionButton from "./native/ActionButton";
import Spinner from "./native/Spinner";
import StatusView, {
  type StatusAction,
  type StatusViewProps,
} from "./native/StatusView";

export function Screen({
  children,
  scroll = true,
  footer,
  footerInset = true,
  onFooterHeight,
  backgroundColor,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  footerInset?: boolean;
  onFooterHeight?: (height: number) => void;
  backgroundColor?: string;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView
      collapsable={false}
      style={{ flex: 1, backgroundColor: backgroundColor ?? c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.page}
        >
          <View style={styles.content}>{children}</View>
        </ScrollView>
      ) : (
        children
      )}
      {footer ? (
        <View
          collapsable={false}
          onLayout={
            onFooterHeight
              ? (event) => onFooterHeight(event.nativeEvent.layout.height)
              : undefined
          }
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: footerInset ? Math.max(insets.bottom, 12) : 12,
            borderTopWidth: 0.5,
            borderColor: c.border,
            backgroundColor: c.surface,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
export function Heading({
  children,
  small = false,
}: {
  children: ReactNode;
  small?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontSize: small ? 21 : 32,
        fontWeight: "700",
        color: c.text,
        marginTop: 8,
        marginBottom: 14,
      }}
    >
      {children}
    </Text>
  );
}
export function Label({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  const c = useTheme();
  return (
    <Text
      style={{ fontSize: 16, lineHeight: 24, color: muted ? c.muted : c.text }}
    >
      {children}
    </Text>
  );
}
export function Card({ children }: { children: ReactNode }) {
  const c = useTheme();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: 20,
        gap: 12,
        marginBottom: 16,
      }}
    >
      {children}
    </View>
  );
}
export { default as Field } from "./native/InputField";

export function Button({
  children,
  onPress,
  kind = "primary",
  disabled = false,
  testID,
}: {
  children: string;
  onPress: () => void | Promise<void>;
  kind?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  testID?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const pending = useRef(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(progressTimer.current);
    };
  }, []);
  const { t } = useLocale();
  return (
    <ActionButton
      label={children}
      kind={kind}
      disabled={disabled || busy}
      busy={showProgress}
      testID={testID}
      onPress={() => {
        if (disabled || pending.current) return;
        pending.current = true;
        setBusy(true);
        // Immediate navigation needs no spinner flash; longer work gets visible feedback.
        progressTimer.current = setTimeout(() => {
          if (mounted.current) setShowProgress(true);
        }, 150);
        Promise.resolve()
          .then(onPress)
          .catch((error) =>
            notify(failureTitle(t, children), userError(error, t)),
          )
          .finally(() => {
            pending.current = false;
            clearTimeout(progressTimer.current);
            if (mounted.current) {
              setBusy(false);
              setShowProgress(false);
            }
          });
      }}
    />
  );
}
export { default as Row } from "./native/NativeRow";

export function Loading() {
  const c = useTheme();
  const { t } = useLocale();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: c.bg,
      }}
    >
      <Spinner label={t("Wczytywanie", "Loading")} />
    </View>
  );
}

/** Icon and title per failure kind, shared by the platform error views. */
export const KINDS: Record<
  ErrorKind,
  Pick<StatusViewProps, "symbol" | "ionicon"> & { title: [string, string] }
> = {
  offline: {
    symbol: "wifi.slash",
    ionicon: "cloud-offline-outline",
    title: ["Brak połączenia", "You’re Offline"],
  },
  timeout: {
    symbol: "clock.badge.exclamationmark",
    ionicon: "time-outline",
    title: ["Brak odpowiedzi", "No Response"],
  },
  maintenance: {
    symbol: "wrench.and.screwdriver",
    ionicon: "construct-outline",
    title: ["Przerwa techniczna", "Down for Maintenance"],
  },
  throttled: {
    symbol: "hourglass",
    ionicon: "hourglass-outline",
    title: ["Zbyt wiele prób", "Too Many Attempts"],
  },
  signIn: {
    symbol: "person.crop.circle.badge.exclamationmark",
    ionicon: "person-circle-outline",
    title: ["Sesja wygasła", "Session Expired"],
  },
  notFound: {
    symbol: "questionmark.folder",
    ionicon: "help-circle-outline",
    title: ["Niedostępne", "Not Available"],
  },
  forbidden: {
    symbol: "lock",
    ionicon: "lock-closed-outline",
    title: ["Brak dostępu", "No Access"],
  },
  server: {
    symbol: "exclamationmark.icloud",
    ionicon: "cloud-outline",
    title: ["Błąd serwera", "Server Problem"],
  },
  other: {
    symbol: "exclamationmark.triangle",
    ionicon: "warning-outline",
    title: ["Nie udało się wczytać", "Couldn’t Load"],
  },
};

/** Explains a failure inline, next to content that did load. */
export function ErrorState({
  error,
  title,
  retry,
}: {
  error: unknown;
  title?: string;
  retry?: () => void;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const kind = KINDS[errorKind(error)];
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 16,
        marginBottom: 8,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: c.surface,
      }}
    >
      {Platform.OS === "ios" ? (
        <SymbolView name={kind.symbol} size={22} tintColor={c.muted} />
      ) : (
        <Ionicons name={kind.ionicon} size={22} color={c.muted} />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          accessibilityRole="header"
          style={{ color: c.text, fontSize: 16, fontWeight: "600" }}
        >
          {title ?? t(...kind.title)}
        </Text>
        <Text
          selectable
          style={{ color: c.muted, fontSize: 15, lineHeight: 20 }}
        >
          {userError(error, t)}
        </Text>
        {retry ? (
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              minHeight: Platform.OS === "ios" ? 44 : 48,
              minWidth: 48,
              justifyContent: "center",
              marginTop: 6,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text style={{ color: c.primary, fontSize: 15, fontWeight: "600" }}>
              {t("Spróbuj ponownie", "Try Again")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A screen whose content failed to load at all. */
export function ErrorScreen({
  error,
  title,
  retry,
  actions = [],
  canLeave = true,
}: {
  error: unknown;
  title?: string;
  retry?: () => void;
  actions?: StatusAction[];
  /** Startup failures have no working screen to navigate back to. */
  canLeave?: boolean;
}) {
  const { t } = useLocale();
  const which = errorKind(error);
  const kind = KINDS[which];
  // Retrying can't bring back something deleted or unshared; leaving can.
  const gone = canLeave && (which === "notFound" || which === "forbidden");
  return (
    <StatusView
      testID="error-screen"
      symbol={kind.symbol}
      ionicon={kind.ionicon}
      title={title ?? t(...kind.title)}
      description={userError(error, t)}
      actions={[
        ...(gone
          ? [
              router.canGoBack()
                ? { label: t("Wróć", "Go Back"), onPress: () => router.back() }
                : {
                    label: t("Przejdź do nauki", "Go to Study"),
                    onPress: () => router.replace("/"),
                  },
            ]
          : retry
            ? [{ label: t("Spróbuj ponownie", "Try Again"), onPress: retry }]
            : []),
        ...actions,
      ]}
    />
  );
}

export { default as EmptyState } from "./native/StatusView";
export { notify, confirm, useConfirm } from "../lib/alerts";
const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", gap: 8 },
});
