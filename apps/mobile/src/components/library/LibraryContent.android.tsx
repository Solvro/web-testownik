import {
  DropdownMenu,
  DropdownMenuItem,
  Icon,
  IconButton,
  ListItem,
  Text as ComposeText,
} from "@expo/ui/jetpack-compose";
import { combinedClickable } from "@expo/ui/jetpack-compose/modifiers";
import type { LibraryItem } from "@testownik/core/quiz/library";
import { Fragment, useState } from "react";
import { RefreshControl, SectionList, View } from "react-native";

import { notify } from "../../lib/alerts";
import { useLocale } from "../../lib/locale";
import { usePullRefresh } from "../../lib/use-pull-refresh";
import { userError } from "../../lib/user-error";
import { useTheme } from "../../lib/theme";
import {
  Collection,
  CollectionDivider,
  CollectionHeading,
  CollectionSkeleton,
  segmentRadius,
} from "../Collection.android";
import type { MenuAction } from "../header-action";
import Segmented from "../grades/GradesPicker.android";
import CollectionRow from "../native/CollectionRow.android";
import { symbol } from "../native/materialIcons.android";
import { ListEmpty, ListError } from "../native/ListStatus.android";
import Spinner from "../native/Spinner";
import type { StatusViewProps } from "../native/StatusView.types";
import { ErrorState, Label } from "../ui";
import type { LibraryContentProps } from "./types";
import M3Host from "../native/M3Host";

// SF Symbols the route passes for its empty states, as Ionicons that map to
// Material Symbols.
const emptyIcons: Record<string, StatusViewProps["ionicon"]> = {
  trash: "trash-outline",
  archivebox: "archive-outline",
  "person.2": "people-outline",
  clock: "time-outline",
  folder: "folder-open-outline",
  "books.vertical": "library-outline",
};

const kindOf = (item: LibraryItem) =>
  item.type === "quiz"
    ? "quiz"
    : item.folder_type === "trash"
      ? "trash"
      : item.folder_type === "archive"
        ? "archive"
        : "folder";

// Android: Material 3 Expressive grouped list. Each item is a Compose
// ListItem segment; tap opens, long-press or the trailing icon button opens a
// Material dropdown menu with the item's actions.
export default function LibraryContent(props: LibraryContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const sections = props.searching
    ? []
    : props.sections.map((section) => ({ ...section, data: section.items }));
  const searchResults = props.searchSections.some((s) => s.quizzes.length);
  const hasContent = sections.some((section) => section.data.length);
  const pull = usePullRefresh(props.refresh);
  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingBottom: 32,
        maxWidth: 800,
        width: "100%",
        alignSelf: "center",
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          {...pull}
          colors={[c.primary]}
          progressBackgroundColor={c.surface}
        />
      }
      ListHeaderComponent={
        <>
          {props.searching ? (
            <>
              {props.searchError && searchResults ? (
                <View style={{ paddingTop: 8 }}>
                  <ErrorState error={props.searchError} retry={props.retry} />
                </View>
              ) : null}
              {props.searchSections.map((section) =>
                section.quizzes.length ? (
                  <Fragment key={section.key}>
                    <CollectionHeading>{section.title}</CollectionHeading>
                    <Collection>
                      {section.quizzes.map((quiz, index) => (
                        <Fragment key={quiz.id}>
                          {index ? <CollectionDivider /> : null}
                          <CollectionRow
                            title={quiz.title}
                            detail={quiz.detail}
                            onPress={() => props.quizActions.open(quiz.id)}
                          />
                        </Fragment>
                      ))}
                    </Collection>
                  </Fragment>
                ) : null,
              )}
            </>
          ) : (
            <>
              {props.backToLibrary ? (
                <View style={{ paddingTop: 8 }}>
                  <Collection>
                    <CollectionRow
                      ionicon="arrow-back"
                      title={t("Wróć do biblioteki", "Back to Library")}
                      onPress={props.backToLibrary}
                    />
                  </Collection>
                </View>
              ) : null}
              {props.scope ? (
                <View style={{ paddingTop: 8 }}>
                  <Segmented
                    segmented
                    label={t("Widok biblioteki", "Library view")}
                    value={props.scope.value}
                    options={props.scope.options}
                    onChange={props.scope.onChange}
                  />
                </View>
              ) : null}
              {props.loading ? (
                <View style={{ paddingTop: 24 }}>
                  <CollectionSkeleton
                    label={t("Wczytywanie biblioteki", "Loading library")}
                  />
                </View>
              ) : null}
              {props.error && hasContent ? (
                <View style={{ paddingTop: 8 }}>
                  <ErrorState error={props.error} retry={props.retry} />
                </View>
              ) : null}
              {props.moving ? (
                <Label muted>{t("Przenoszenie…", "Moving…")}</Label>
              ) : null}
            </>
          )}
        </>
      }
      renderSectionHeader={({ section }) => (
        <CollectionHeading
          trailing={section.key === "storage" ? undefined : section.data.length}
        >
          {section.title}
        </CollectionHeading>
      )}
      renderSectionFooter={() => <View style={{ height: 8 }} />}
      renderItem={({ item, index, section }) => (
        <View
          style={{
            ...segmentRadius(index, section.data.length),
            backgroundColor: c.surface,
            overflow: "hidden",
            marginBottom: index === section.data.length - 1 ? 0 : 2,
          }}
        >
          <LibraryRow
            title={props.name(item)}
            detail={props.detail(item)}
            kind={kindOf(item)}
            actions={props.menu(item).flat()}
            onPress={() => props.open(item)}
          />
        </View>
      )}
      ListEmptyComponent={
        props.searching ? (
          searchResults ? null : props.searchLoading ? (
            <View
              style={{
                flexGrow: 1,
                justifyContent: "center",
                alignItems: "center",
                paddingVertical: 48,
              }}
            >
              <Spinner label={t("Wyszukiwanie", "Searching")} />
            </View>
          ) : props.searchError ? (
            <ListError error={props.searchError} retry={props.retry} />
          ) : (
            <ListEmpty
              ionicon="search-outline"
              title={t("Brak wyników", "No Results")}
              description={t(
                "Sprawdź pisownię albo wpisz inną frazę.",
                "Check the spelling or try a different search.",
              )}
            />
          )
        ) : props.loading ? null : props.error ? (
          <ListError error={props.error} retry={props.retry} />
        ) : (
          <ListEmpty
            ionicon={
              emptyIcons[props.empty.symbol ?? "folder"] ??
              "folder-open-outline"
            }
            title={props.empty.title}
            description={props.empty.description}
          />
        )
      }
    />
  );
}

function LibraryRow({
  title,
  detail,
  kind,
  actions,
  onPress,
}: {
  title: string;
  detail?: string;
  kind: ReturnType<typeof kindOf>;
  actions: MenuAction[];
  onPress: () => void;
}) {
  const c = useTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const run = (action: MenuAction) => {
    setOpen(false);
    void Promise.resolve()
      .then(action.onPress)
      .catch((e) =>
        notify(t("Nie udało się", "Something Went Wrong"), userError(e, t)),
      );
  };
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <DropdownMenu expanded={open} onDismissRequest={() => setOpen(false)}>
        <DropdownMenu.Trigger>
          <ListItem
            colors={{
              containerColor: c.surface,
              contentColor: c.text,
              supportingContentColor: c.muted,
            }}
            modifiers={[
              combinedClickable({
                onClick: onPress,
                onLongClick: () => {
                  if (actions.length) setOpen(true);
                },
              }),
            ]}
          >
            <ListItem.HeadlineContent>
              <ComposeText
                maxLines={2}
                overflow="ellipsis"
                style={{ typography: "bodyLarge" }}
              >
                {title}
              </ComposeText>
            </ListItem.HeadlineContent>
            {detail ? (
              <ListItem.SupportingContent>
                <ComposeText
                  maxLines={1}
                  overflow="ellipsis"
                  style={{ typography: "bodyMedium" }}
                >
                  {detail}
                </ComposeText>
              </ListItem.SupportingContent>
            ) : null}
            <ListItem.LeadingContent>
              <Icon
                source={symbol(
                  kind === "folder"
                    ? "folder"
                    : kind === "archive"
                      ? "archive"
                      : kind === "trash"
                        ? "delete"
                        : "description",
                )}
                tint={kind === "folder" ? c.primary : c.muted}
                size={24}
              />
            </ListItem.LeadingContent>
            {actions.length ? (
              <ListItem.TrailingContent>
                <IconButton onClick={() => setOpen(true)}>
                  <Icon
                    source={symbol("more")}
                    tint={c.muted}
                    size={24}
                    contentDescription={t(
                      `Opcje: ${title}`,
                      `Options: ${title}`,
                    )}
                  />
                </IconButton>
              </ListItem.TrailingContent>
            ) : null}
          </ListItem>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.title}
              enabled={!action.disabled}
              elementColors={{
                textColor: action.destructive ? c.danger : c.text,
              }}
              onClick={() => run(action)}
            >
              <DropdownMenuItem.Text>
                <ComposeText>{action.title}</ComposeText>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </M3Host>
  );
}
