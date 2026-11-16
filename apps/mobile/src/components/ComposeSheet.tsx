import { Stack, router, useNavigation } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { usePreventRemove } from "expo-router/react-navigation";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { useConfirm } from "../lib/alerts";
import { haptics } from "../lib/haptics";
import { useLocale } from "../lib/locale";
import { useTheme } from "../lib/theme";
import { userError } from "../lib/user-error";
import { Button } from "./ui";

const SendingContext = createContext(false);

/**
 * A modal compose screen: Cancel on the leading side, one prominent action on
 * the trailing side that stays disabled until the form is valid. Typed text is
 * never discarded without asking, and a swipe cannot dismiss a dirty sheet.
 */
export default function ComposeSheet({
  title,
  action,
  valid,
  dirty,
  send,
  footer,
  children,
}: {
  title: string;
  action: string;
  valid: boolean;
  dirty: boolean;
  send: () => Promise<void>;
  footer?: string;
  children: ReactNode;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const confirm = useConfirm();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const allowRemoval = useRef(false);
  const navigation = useNavigation();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  usePreventRemove(dirty || sending, ({ data }) => {
    if (allowRemoval.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (lock.current) return;
    confirm(
      t("Odrzucić wiadomość?", "Discard This Message?"),
      t("Wpisany tekst zostanie usunięty.", "What you typed will be lost."),
      () => navigation.dispatch(data.action),
      { action: t("Odrzuć", "Discard") },
    );
  });
  const leave = () => {
    allowRemoval.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const submit = async () => {
    if (lock.current || !valid) return;
    lock.current = true;
    setSending(true);
    setError(null);
    try {
      await send();
      if (!mounted.current) return;
      haptics.success();
      leave();
    } catch (failure) {
      if (!mounted.current) return;
      haptics.error();
      setError(failure);
    } finally {
      lock.current = false;
      if (mounted.current) setSending(false);
    }
  };
  const cancel = () => {
    if (lock.current) return;
    if (dirty)
      confirm(
        t("Odrzucić wiadomość?", "Discard This Message?"),
        t("Wpisany tekst zostanie usunięty.", "What you typed will be lost."),
        leave,
        { action: t("Odrzuć", "Discard") },
      );
    else leave();
  };
  // Stack.Toolbar drops text-only items on Android; use the inline Send button.
  const native = Platform.OS === "ios";
  return (
    <SendingContext.Provider value={sending}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: c.bg }}
      >
        <Stack.Screen
          options={{
            title,
            gestureEnabled: !dirty && !sending,
            headerBackVisible: !sending,
          }}
        />
        {native ? (
          <>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button disabled={sending} onPress={cancel}>
                {t("Anuluj", "Cancel")}
              </Stack.Toolbar.Button>
            </Stack.Toolbar>
            <Stack.Toolbar placement="right">
              <Stack.Toolbar.Button
                variant="prominent"
                tintColor={c.prominent}
                disabled={!valid || sending}
                onPress={() => void submit()}
              >
                {sending ? t("Wysyłanie…", "Sending…") : action}
              </Stack.Toolbar.Button>
            </Stack.Toolbar>
          </>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{
            padding: 20,
            gap: 10,
            maxWidth: 760,
            width: "100%",
            alignSelf: "center",
          }}
        >
          <View
            style={{
              backgroundColor: c.surface,
              borderRadius: 14,
              borderCurve: "continuous",
              overflow: "hidden",
            }}
          >
            {children}
          </View>
          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: c.danger, fontSize: 13, paddingHorizontal: 16 }}
            >
              {userError(error, t)}
            </Text>
          ) : footer ? (
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: c.muted, fontSize: 13, paddingHorizontal: 16 }}
            >
              {footer}
            </Text>
          ) : null}
          {native ? null : (
            <>
              <Button disabled={!valid || sending} onPress={submit}>
                {action}
              </Button>
              <Button kind="secondary" disabled={sending} onPress={cancel}>
                {t("Anuluj", "Cancel")}
              </Button>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SendingContext.Provider>
  );
}

/** A borderless field for use inside ComposeSheet; rows are separated by a hairline. */
export function ComposeField({
  divider,
  multiline,
  style,
  ...props
}: TextInputProps & { divider?: boolean; ref?: Ref<TextInput> }) {
  const c = useTheme();
  const sending = useContext(SendingContext);
  return (
    <>
      {divider ? (
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: c.border,
            marginLeft: 16,
          }}
        />
      ) : null}
      <TextInput
        {...props}
        editable={!sending && props.editable !== false}
        multiline={multiline}
        placeholderTextColor={c.muted}
        clearButtonMode={multiline ? "never" : "while-editing"}
        style={[
          {
            paddingHorizontal: 16,
            paddingVertical: 14,
            minHeight: multiline ? 180 : 50,
            color: c.text,
            fontSize: 17,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
    </>
  );
}
