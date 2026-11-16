import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { ErrorScreen, Loading } from "../src/components/ui";
import { exchangeOAuth } from "../src/lib/oauth";
import { useSession } from "../src/lib/session";
import { useLocale } from "../src/lib/locale";
import { UserFacingError } from "../src/lib/user-error";

export default function Auth() {
  const { t } = useLocale();
  const params = useLocalSearchParams<{
      error?: string;
      code: string;
      state: string;
    }>(),
    { login, user } = useSession(),
    [error, setError] = useState<unknown>(null);
  const staleCallback =
    error instanceof UserFacingError && error.code === "oauthState" && !!user;
  useEffect(() => {
    // A consumed callback can arrive again after sign-in has already finished.
    // Keep a surviving session usable without redeeming or clearing any flow.
    if (staleCallback) router.replace("/");
  }, [staleCallback]);
  useEffect(() => {
    let active = true;
    (async () => {
      if (params.error)
        throw new UserFacingError(
          params.error === "access_denied" ? "oauthCancelled" : "oauthFailed",
        );
      const tokens = await exchangeOAuth({
        code: params.code,
        state: params.state,
      });
      if (!active) return;
      await login(tokens);
      if (active) router.replace("/");
    })().catch((e) => {
      if (active) setError(e);
    });
    return () => {
      active = false;
    };
  }, [params.error, params.code, params.state, login]);
  return error && !staleCallback ? (
    <ErrorScreen
      title={t("Nie udało się zalogować", "Couldn’t Sign In")}
      error={error}
      actions={[
        {
          label: t("Wróć do logowania", "Back to Sign In"),
          onPress: () => router.replace("/login"),
          primary: true,
        },
      ]}
    />
  ) : (
    <Loading />
  );
}
