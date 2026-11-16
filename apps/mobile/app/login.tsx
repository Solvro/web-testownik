import * as Crypto from "expo-crypto";
import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { Image, View } from "react-native";
import {
  Button,
  ErrorState,
  Heading,
  Label,
  Screen,
} from "../src/components/ui";
import { WEB_URL } from "../src/lib/api";
import { clearOAuth, saveOAuth, type OAuthFlow } from "../src/lib/oauth";
import {
  OAUTH_CLIENT_ID,
  OAUTH_REDIRECT_URI,
  OAUTH_SCOPES,
} from "../src/lib/oauth-config";
import { useSession } from "../src/lib/session";
import { useLocale } from "../src/lib/locale";

WebBrowser.maybeCompleteAuthSession();
export default function Login() {
  const s = useSession();
  const { t } = useLocale();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (s.user) return <Redirect href="/" />;
  async function signIn() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    let flow: OAuthFlow | undefined;
    try {
      const verifier =
        Crypto.randomUUID().replaceAll("-", "") +
        Crypto.randomUUID().replaceAll("-", "");
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      );
      const state = Crypto.randomUUID().replaceAll("-", "");
      flow = { verifier, state };
      await saveOAuth(flow);
      const params = new URLSearchParams({
        client_id: OAUTH_CLIENT_ID,
        redirect_uri: OAUTH_REDIRECT_URI,
        response_type: "code",
        scope: OAUTH_SCOPES,
        state,
        code_challenge_method: "S256",
        code_challenge: digest
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", ""),
      });
      const result = await WebBrowser.openAuthSessionAsync(
        `${WEB_URL}/oauth/authorize?${params}`,
        OAUTH_REDIRECT_URI,
      );
      if (result.type === "success") {
        const url = new URL(result.url);
        router.push({
          pathname: "/auth",
          params: Object.fromEntries(url.searchParams),
        });
      } else if (result.type === "cancel") await clearOAuth(flow);
    } catch (failure) {
      if (flow) await clearOAuth(flow).catch(() => undefined);
      setError(failure);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={{ gap: 16, paddingVertical: 48 }}>
        <Image
          source={require("../assets/icon.png")}
          style={{ width: 72, height: 72, borderRadius: 18 }}
          accessibilityLabel="Testownik"
        />
        <Heading>{t("Ucz się po swojemu.", "Make learning yours.")}</Heading>
        <Label muted>
          {t(
            "Twoje quizy, powtórki i postępy — zawsze pod ręką.",
            "Your quizzes, revision and progress, always with you.",
          )}
        </Label>
      </View>
      {error ? <ErrorState error={error} /> : null}
      <Button disabled={busy} onPress={signIn}>
        {t("Zaloguj się do Testownika", "Sign in to Testownik")}
      </Button>
      <Label muted>
        {t(
          "Otworzymy bezpieczne logowanie w przeglądarce. Wybierz USOS, Solvro lub e-mail — tak jak w wersji internetowej.",
          "Continue securely in your browser. Choose USOS, Solvro or email, just like on the web.",
        )}
      </Label>
    </Screen>
  );
}
