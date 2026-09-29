import { ActivityIndicator, View } from "react-native";

import { useLocale } from "../../lib/locale";
import Card, { SectionTitle as Heading } from "../SettingsGroup";
import ToggleRow from "../ToggleRow";
import Overflow from "../Overflow";
import { Button, ErrorState, Label, Row, Screen } from "../ui";
import { notify } from "../../lib/alerts";
import type { AccountContentProps } from "./types";

// Browser preview and Android. iOS renders a native SwiftUI list instead.
export default function AccountContent(props: AccountContentProps) {
  const { t } = useLocale();
  return (
    <Screen>
      <Heading small>{t("Twoje dane", "Your Information")}</Heading>
      <Card>
        <Row title={props.name} detail={props.email ?? undefined} />
        <ToggleRow
          label={t("Ukryj profil", "Hide Profile")}
          detail={t(
            "Ukryty profil nie pojawia się innym osobom w wyszukiwaniu i przy udostępnianiu.",
            "A hidden profile doesn’t appear to other people in search or when sharing.",
          )}
          value={props.hideProfile}
          busy={props.busy}
          onValueChange={props.setHideProfile}
        />
      </Card>
      {props.privacyError ? (
        <ErrorState
          title={t("Nie zapisano zmiany", "Change Not Saved")}
          error={props.privacyError}
        />
      ) : null}
      <Heading small>{t("Połączone aplikacje", "Connected Apps")}</Heading>
      {props.appsLoading ? <ActivityIndicator /> : null}
      {props.appsError ? (
        <ErrorState error={props.appsError} retry={props.retryApps} />
      ) : null}
      {props.apps?.length === 0 ? (
        <Label muted>
          {t(
            "Żadna dodatkowa aplikacja nie ma dostępu do Twojego konta.",
            "No other apps have access to your account.",
          )}
        </Label>
      ) : null}
      {props.apps?.length ? (
        <Card>
          {props.apps.map((app) => (
            <View
              key={app.id}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <View style={{ flex: 1 }}>
                <Row
                  title={
                    app.current
                      ? `${app.name} (${t("ta aplikacja", "this app")})`
                      : app.name
                  }
                  detail={t(
                    `Uprawnienia: ${app.permissions.length}`,
                    `Permissions: ${app.permissions.length}`,
                  )}
                />
              </View>
              <Overflow
                label={t(`Opcje ${app.name}`, `Options for ${app.name}`)}
                items={[
                  {
                    title: t("Pokaż uprawnienia", "View Permissions"),
                    onPress: () => notify(app.name, app.permissions.join("\n")),
                  },
                  ...(app.current
                    ? []
                    : [
                        {
                          title: t("Odłącz aplikację", "Disconnect App"),
                          destructive: true,
                          onPress: () => props.disconnect(app),
                        },
                      ]),
                ]}
              />
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <Row
          title={t("Polityka prywatności", "Privacy Policy")}
          onPress={props.openPrivacyPolicy}
        />
      </Card>
      {props.deleteAccount ? (
        <Button kind="danger" onPress={props.deleteAccount}>
          {t("Usuń konto", "Delete Account")}
        </Button>
      ) : null}
    </Screen>
  );
}
