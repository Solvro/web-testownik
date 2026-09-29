import QuizRow, {
  fill,
  Chevron,
  rowLabel,
  secondary,
} from "../quiz-list/QuizRow";
import type { LibraryItem } from "@testownik/core/quiz/library";
import {
  Button,
  ContentUnavailableView,
  ContextMenu,
  Divider,
  Host,
  HStack,
  Image,
  Label,
  List,
  Picker,
  ProgressView,
  Section,
  SwipeActions,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  font,
  frame,
  labelsHidden,
  lineLimit,
  listRowBackground,
  listRowInsets,
  listStyle,
  redacted,
  refreshable,
  scrollDismissesKeyboard,
  pickerStyle,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { type ComponentProps, Fragment } from "react";
import { useWindowDimensions } from "react-native";

import {
  libraryDraggable,
  libraryDropDestination,
  libraryDropZone,
} from "../../../modules/library-drag/src/modifiers";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import { userError } from "../../lib/user-error";
import type { MenuAction } from "../header-action";
import type { LibraryContentProps, SwipeAction } from "./types";

const symbol = (item: LibraryItem) =>
  item.shortcut_id
    ? "link"
    : item.type === "quiz"
      ? "doc.text"
      : item.folder_type === "archive"
        ? "archivebox"
        : item.folder_type === "trash"
          ? "trash"
          : "folder.fill";

export default function LibraryContent(props: LibraryContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const { fontScale } = useWindowDimensions();

  const menuButton = (action: MenuAction) => (
    <Button
      key={action.title}
      label={action.title}
      systemImage={action.icon}
      role={action.destructive ? "destructive" : undefined}
      onPress={() => void action.onPress()}
    />
  );
  // No role="destructive" on swipes: it removes the row before the
  // confirmation, and the row stays gone if you cancel.
  const swipeButton = (action: SwipeAction) => (
    <Button
      key={action.title}
      label={action.title}
      systemImage={action.icon}
      modifiers={action.tint ? [tint(action.tint)] : []}
      onPress={() => void action.onPress()}
    />
  );

  const row = (item: LibraryItem) => {
    const groups = props.menu(item).filter((group) => group.length);
    const swipe = props.swipe(item);
    const detail = props.detail(item);
    const folder = item.type === "folder";
    return (
      <SwipeActions key={`${item.type}:${item.id}`}>
        <ContextMenu
          // On the menu itself so a long press can lift the row into a drag.
          modifiers={[
            libraryDraggable({
              url: props.link(item),
              enabled: props.canDrag(item),
            }),
            ...(props.canDrop(item)
              ? [libraryDropDestination({ id: item.id })]
              : []),
          ]}
        >
          <ContextMenu.Trigger>
            <Button
              onPress={() => props.open(item)}
              modifiers={[rowLabel, accessibilityLabel(props.name(item))]}
            >
              <HStack spacing={14}>
                <Image
                  systemName={symbol(item)}
                  size={20}
                  color={
                    folder && item.folder_type === "regular"
                      ? c.primary
                      : undefined
                  }
                  modifiers={[
                    frame({ width: 28 }),
                    ...(folder && item.folder_type === "regular"
                      ? []
                      : [secondary]),
                  ]}
                />
                <VStack alignment="leading" spacing={2} modifiers={[fill]}>
                  <Text modifiers={fontScale > 1.3 ? [] : [lineLimit(2)]}>
                    {props.name(item)}
                  </Text>
                  {detail ? (
                    <Text
                      modifiers={[font({ textStyle: "footnote" }), secondary]}
                    >
                      {detail}
                    </Text>
                  ) : null}
                </VStack>
                <Chevron />
              </HStack>
            </Button>
          </ContextMenu.Trigger>
          {groups.length ? (
            <ContextMenu.Items>
              {groups.map((group, index) => (
                <Fragment key={index}>
                  {index ? <Divider /> : null}
                  {group.map(menuButton)}
                </Fragment>
              ))}
            </ContextMenu.Items>
          ) : null}
        </ContextMenu>
        {swipe.leading.length ? (
          <SwipeActions.Actions edge="leading">
            {swipe.leading.map(swipeButton)}
          </SwipeActions.Actions>
        ) : null}
        {swipe.trailing.length ? (
          <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
            {swipe.trailing.map(swipeButton)}
          </SwipeActions.Actions>
        ) : null}
      </SwipeActions>
    );
  };

  const searchResults = props.searchSections.some((s) => s.quizzes.length);

  return (
    <Host style={{ flex: 1 }}>
      <List
        modifiers={[
          listStyle("insetGrouped"),
          libraryDropZone(props.drop),
          scrollDismissesKeyboard("immediately"),
          refreshable(async () => {
            await props.refresh();
          }),
        ]}
      >
        {props.searching ? (
          <>
            {props.searchError ? (
              <Section>
                <Label
                  title={userError(props.searchError, t)}
                  systemImage="exclamationmark.triangle"
                />
                <Button
                  label={t("Spróbuj ponownie", "Try Again")}
                  onPress={props.retry}
                />
              </Section>
            ) : null}
            {props.searchLoading && !searchResults ? (
              <Section>
                <ProgressView modifiers={[frame({ maxWidth: Infinity })]} />
              </Section>
            ) : null}
            {props.searchSections.map((section) =>
              section.quizzes.length ? (
                <Section key={section.key} title={section.title}>
                  {section.quizzes.map((quiz) => (
                    <QuizRow
                      key={quiz.id}
                      quiz={quiz}
                      actions={props.quizActions}
                    />
                  ))}
                </Section>
              ) : null,
            )}
            {!props.searchLoading && !props.searchError && !searchResults ? (
              <Section>
                <ContentUnavailableView
                  modifiers={[listRowBackground("transparent")]}
                  title={t(
                    `Brak wyników dla „${props.query.trim()}”`,
                    `No Results for “${props.query.trim()}”`,
                  )}
                  systemImage="magnifyingglass"
                  description={t(
                    "Sprawdź pisownię albo wpisz inną frazę.",
                    "Check the spelling or try a different search.",
                  )}
                />
              </Section>
            ) : null}
          </>
        ) : (
          <>
            {props.scope ? (
              <Section>
                <Picker
                  label=""
                  selection={props.scope.value}
                  onSelectionChange={props.scope.onChange}
                  modifiers={[
                    pickerStyle("segmented"),
                    labelsHidden(),
                    listRowBackground("transparent"),
                    listRowInsets({
                      top: 0,
                      leading: 0,
                      bottom: 0,
                      trailing: 0,
                    }),
                  ]}
                >
                  {props.scope.options.map((option) => (
                    <Text key={option.value} modifiers={[tag(option.value)]}>
                      {option.label}
                    </Text>
                  ))}
                </Picker>
              </Section>
            ) : null}
            {props.moving ? (
              <Section>
                <HStack spacing={10}>
                  <ProgressView />
                  <Text modifiers={[secondary]}>
                    {t("Przenoszenie…", "Moving…")}
                  </Text>
                </HStack>
              </Section>
            ) : null}
            {props.error ? (
              <Section>
                <Label
                  title={userError(props.error, t)}
                  systemImage="exclamationmark.triangle"
                />
                <Button
                  label={t("Spróbuj ponownie", "Try Again")}
                  onPress={props.retry}
                />
              </Section>
            ) : null}
            {props.loading ? (
              <Section>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Label
                    key={i}
                    title={
                      i % 2
                        ? "Quiz title placeholder"
                        : "Longer quiz title placeholder"
                    }
                    systemImage="doc.text"
                    modifiers={[redacted("placeholder")]}
                  />
                ))}
              </Section>
            ) : null}
            {props.sections.map((section) => (
              <Section key={section.key} title={section.title}>
                {section.items.map(row)}
              </Section>
            ))}
            {props.backToLibrary ? (
              <Section>
                <Button
                  label={t("Wróć do biblioteki", "Back to Library")}
                  systemImage="books.vertical"
                  onPress={props.backToLibrary}
                />
              </Section>
            ) : null}
            {!props.loading && !props.error && !props.sections.length ? (
              <Section>
                <ContentUnavailableView
                  modifiers={[listRowBackground("transparent")]}
                  title={props.empty.title}
                  systemImage={
                    (props.empty.symbol ?? "folder") as ComponentProps<
                      typeof ContentUnavailableView
                    >["systemImage"]
                  }
                  description={props.empty.description}
                />
              </Section>
            ) : null}
          </>
        )}
      </List>
    </Host>
  );
}
