import {
  Button,
  Divider,
  Host,
  HStack,
  Image,
  RNHostView,
  Label,
  LabeledContent,
  List,
  Menu,
  Picker,
  ProgressView,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from "@expo/ui/swift-ui";
import {
  disabled,
  font,
  foregroundStyle,
  listStyle,
  pickerStyle,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";
import PersonAvatar from "../PersonAvatar";
import { rowLabel, secondary } from "../quiz-list/QuizRow";
import { IconTile, tile } from "../settings/SettingsRows";
import type { ShareContentProps } from "./types";

const visibilitySymbols = [
  "lock.fill",
  "person.2.fill",
  "link",
  "globe",
] as const;

export default function ShareContent(props: ShareContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const quiz = props.quiz;
  const owner = quiz.can_edit;
  // Menu labels take the accent tint; keep this one gray like a Settings value.
  const muted = foregroundStyle({ type: "color", color: c.muted });
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle("insetGrouped")]}>
        <Section footer={<Text>{props.linkNote}</Text>}>
          <VStack alignment="leading" spacing={4}>
            <Text modifiers={[font({ textStyle: "headline" })]}>
              {quiz.title}
            </Text>
            <Text modifiers={[font({ textStyle: "subheadline" }), secondary]}>
              {props.labels[quiz.visibility]}
            </Text>
          </VStack>
          <Button onPress={props.shareLink} modifiers={[rowLabel]}>
            <HStack spacing={14}>
              <IconTile symbol="square.and.arrow.up" color={tile.blue} />
              <Text>{t("Wyślij link", "Share Link")}</Text>
              <Spacer />
            </HStack>
          </Button>
        </Section>

        {props.quizError ? (
          <Section>
            <Label
              title={userError(props.quizError, t)}
              systemImage="exclamationmark.triangle"
            />
            <Button
              label={t("Spróbuj ponownie", "Try Again")}
              onPress={props.retryQuiz}
            />
          </Section>
        ) : null}
        {!owner ? (
          <Section
            title={t("Dostęp", "Access")}
            footer={
              <Text>
                {t(
                  "Ustawienia udostępniania może zmienić autor quizu.",
                  "Only the quiz author can change sharing settings.",
                )}
              </Text>
            }
          >
            {quiz.creator && !quiz.is_anonymous ? (
              <LabeledContent label={t("Autor", "Author")}>
                <Text modifiers={[secondary]}>{quiz.creator.full_name}</Text>
              </LabeledContent>
            ) : null}
            <LabeledContent label={t("Kto może otworzyć", "Who Can Open")}>
              <Text modifiers={[secondary]}>
                {props.labels[quiz.visibility]}
              </Text>
            </LabeledContent>
          </Section>
        ) : (
          <>
            <Section
              title={t("Kto może otworzyć", "Who Can Open")}
              footer={
                <Text>
                  {props.failure
                    ? `${props.failureTitle ?? t("Nie zapisano zmiany", "The change was not saved")}: ${userError(props.failure, t)}`
                    : props.explanations[quiz.visibility]}
                </Text>
              }
            >
              <Picker
                label={
                  <HStack spacing={14}>
                    <IconTile
                      symbol={visibilitySymbols[quiz.visibility] ?? "link"}
                      color={quiz.visibility === 0 ? tile.gray : tile.green}
                    />
                    <Text modifiers={[rowLabel]}>
                      {t("Widoczność", "Visibility")}
                    </Text>
                  </HStack>
                }
                selection={quiz.visibility}
                onSelectionChange={(value: number) => {
                  if (value !== quiz.visibility) props.setVisibility(value);
                }}
                modifiers={[
                  pickerStyle("menu"),
                  tint(c.muted),
                  disabled(props.busy),
                ]}
              >
                {props.labels.map((label, index) => (
                  <Text key={label} modifiers={[tag(index)]}>
                    {label}
                  </Text>
                ))}
              </Picker>
              {quiz.visibility >= 2 ? (
                <Toggle
                  label={t("Bez logowania", "Open Without Signing In")}
                  isOn={quiz.allow_anonymous}
                  onIsOnChange={props.setAnonymousAccess}
                  modifiers={[disabled(props.busy)]}
                />
              ) : null}
              <Toggle
                label={t("Ukryj autora", "Hide Author")}
                isOn={quiz.is_anonymous}
                onIsOnChange={props.setHideAuthor}
                modifiers={[disabled(props.busy)]}
              />
            </Section>

            <Section
              title={t("Osoby i grupy", "People and Groups")}
              footer={
                quiz.visibility === 0 ? (
                  <Text>
                    {t(
                      "Quiz jest prywatny, więc zaproszenia są nieaktywne. Zmień widoczność, aby zaproszeni mieli dostęp.",
                      "The quiz is private, so invitations are inactive. Change visibility to give invited people access.",
                    )}
                  </Text>
                ) : undefined
              }
            >
              <Button onPress={props.invite} modifiers={[rowLabel]}>
                <HStack spacing={14}>
                  <IconTile symbol="person.badge.plus" color={tile.blue} />
                  <Text>
                    {t("Dodaj osoby lub grupy", "Add People or Groups")}
                  </Text>
                  <Spacer />
                </HStack>
              </Button>
              {props.sharesLoading ? <ProgressView /> : null}
              {props.sharesError ? (
                <>
                  <Label
                    title={userError(props.sharesError, t)}
                    systemImage="exclamationmark.triangle"
                  />
                  <Button
                    label={t("Spróbuj ponownie", "Try Again")}
                    onPress={props.retryShares}
                  />
                </>
              ) : null}
              {props.shares?.map((share) => {
                const name =
                  share.user?.full_name ??
                  share.group?.name ??
                  t("Nieznany", "Unknown");
                return (
                  <HStack key={share.id} spacing={14}>
                    <RNHostView matchContents>
                      <PersonAvatar
                        name={name}
                        photo={share.user?.photo}
                        level={share.user?.account_level}
                        group={!!share.group}
                        size={32}
                      />
                    </RNHostView>
                    <Text>{name}</Text>
                    <Spacer />
                    <Menu
                      label={
                        <HStack spacing={4}>
                          <Text modifiers={[muted]}>
                            {share.allow_edit
                              ? t("Może edytować", "Can Edit")
                              : t("Może się uczyć", "Can Study")}
                          </Text>
                          <Image
                            systemName="chevron.up.chevron.down"
                            size={11}
                            modifiers={[muted]}
                          />
                        </HStack>
                      }
                      modifiers={[disabled(props.busy)]}
                    >
                      {/* A native picker keeps the checkmark aligned like Calendar's menus. */}
                      <Picker
                        label={t("Dostęp", "Access")}
                        selection={share.allow_edit ? "edit" : "study"}
                        onSelectionChange={(value: string) =>
                          props.setRole(share, value === "edit")
                        }
                        modifiers={[pickerStyle("inline")]}
                      >
                        <Text modifiers={[tag("study")]}>
                          {t("Może się uczyć", "Can Study")}
                        </Text>
                        <Text modifiers={[tag("edit")]}>
                          {t("Może edytować", "Can Edit")}
                        </Text>
                      </Picker>
                      <Divider />
                      <Button
                        label={t("Odbierz dostęp", "Remove Access")}
                        systemImage="person.badge.minus"
                        role="destructive"
                        onPress={() => props.remove(share)}
                      />
                    </Menu>
                  </HStack>
                );
              })}
              {props.shares && !props.shares.length && !props.sharesLoading ? (
                <Text
                  modifiers={[secondary, font({ textStyle: "subheadline" })]}
                >
                  {t(
                    "Nikogo jeszcze nie zaproszono.",
                    "No one has been invited yet.",
                  )}
                </Text>
              ) : null}
            </Section>
          </>
        )}
      </List>
    </Host>
  );
}
