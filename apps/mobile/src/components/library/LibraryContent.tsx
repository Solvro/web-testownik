import type { LibraryItem } from "@testownik/core/quiz/library";
import { Fragment } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SectionList,
  View,
} from "react-native";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import {
  Collection,
  CollectionDivider,
  CollectionHeading,
  CollectionSkeleton,
} from "../Collection";
import Overflow from "../Overflow";
import Segmented from "../grades/GradesPicker";
import CollectionRow from "../native/CollectionRow";
import LibraryDrag from "../native/LibraryDrag";
import { ErrorState, Field, Heading, Label, Row } from "../ui";
import type { LibraryContentProps } from "./types";

const kind = (item: LibraryItem) =>
  item.type === "quiz"
    ? "quiz"
    : item.folder_type === "trash"
      ? "trash"
      : item.folder_type === "archive"
        ? "archive"
        : "folder";

// Browser preview and Android. iOS renders a native SwiftUI list instead.
export default function LibraryContent(props: LibraryContentProps) {
  const c = useTheme();
  const { t } = useLocale();
  const sections = props.searching
    ? []
    : props.sections.map((section) => ({ ...section, data: section.items }));
  const searchResults = props.searchSections.some((s) => s.quizzes.length);
  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      sections={sections}
      stickySectionHeadersEnabled={false}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxWidth: 800,
        width: "100%",
        alignSelf: "center",
      }}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => void props.refresh()}
        />
      }
      ListHeaderComponent={
        <>
          {Platform.OS === "web" ? (
            <Field
              label={t("Szukaj quizu", "Search quizzes")}
              value={props.query}
              onChangeText={props.setQuery}
              returnKeyType="search"
            />
          ) : null}
          {props.searching ? (
            <>
              {props.searchError ? (
                <ErrorState error={props.searchError} retry={props.retry} />
              ) : null}
              {props.searchLoading && !searchResults ? (
                <ActivityIndicator style={{ paddingTop: 32 }} />
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
              {!props.searchLoading && !props.searchError && !searchResults ? (
                <View style={{ paddingVertical: 40, gap: 12 }}>
                  <Heading small>{t("Brak wyników", "No Results")}</Heading>
                  <Label muted>
                    {t(
                      "Sprawdź pisownię albo wpisz inną frazę.",
                      "Check the spelling or try a different search.",
                    )}
                  </Label>
                </View>
              ) : null}
            </>
          ) : (
            <>
              {props.backToLibrary ? (
                <Row
                  title={t("Wróć do biblioteki", "Back to Library")}
                  onPress={props.backToLibrary}
                />
              ) : null}
              {props.loading ? (
                <CollectionSkeleton
                  label={t("Wczytywanie biblioteki", "Loading library")}
                />
              ) : null}
              {props.error ? (
                <ErrorState error={props.error} retry={props.retry} />
              ) : null}
              {props.scope ? (
                <Segmented
                  segmented
                  label={t("Widok biblioteki", "Library view")}
                  value={props.scope.value}
                  options={props.scope.options}
                  onChange={props.scope.onChange}
                />
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
      renderItem={({ item, index, section }) => {
        const actions = props.menu(item).flat();
        return (
          <LibraryDrag
            itemId={item.id}
            itemKind={item.type}
            itemName={props.name(item)}
            dragEnabled={props.canDrag(item)}
            dropEnabled={props.canDrop(item)}
            onMove={(event) => props.drop(event.nativeEvent)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: c.surface,
              borderTopLeftRadius: index === 0 ? 16 : 0,
              borderTopRightRadius: index === 0 ? 16 : 0,
              borderBottomLeftRadius:
                index === section.data.length - 1 ? 16 : 0,
              borderBottomRightRadius:
                index === section.data.length - 1 ? 16 : 0,
              overflow: "hidden",
              borderBottomWidth: index === section.data.length - 1 ? 0 : 0.5,
              borderBottomColor: c.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <CollectionRow
                title={props.name(item)}
                kind={kind(item)}
                detail={props.detail(item)}
                onPress={() => props.open(item)}
              />
            </View>
            {actions.length ? (
              <Overflow
                muted
                label={t(
                  `Opcje: ${props.name(item)}`,
                  `Options: ${props.name(item)}`,
                )}
                items={actions}
              />
            ) : null}
          </LibraryDrag>
        );
      }}
      ListEmptyComponent={
        !props.searching && !props.loading && !props.error ? (
          <View style={{ paddingVertical: 40, gap: 12 }}>
            <Heading small>{props.empty.title}</Heading>
            <Label muted>{props.empty.description}</Label>
          </View>
        ) : null
      }
    />
  );
}
