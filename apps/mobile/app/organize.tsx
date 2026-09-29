import { userError } from "../src/lib/user-error";
import { canMoveTo, type LibraryData } from "@testownik/core/quiz/library";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Platform, Text, View } from "react-native";
import { Collection, CollectionDivider } from "../src/components/Collection";
import CollectionRow from "../src/components/native/CollectionRow";
import { useTheme } from "../src/lib/theme";
import {
  Button,
  ErrorState,
  Field,
  Label,
  Loading,
  Screen,
  notify,
} from "../src/components/ui";
import { api } from "../src/lib/api";
import { useLocale } from "../src/lib/locale";

/** Move pickers waiting to hear about a folder created on top of them. */
const created = new Set<(folder: string) => void>();

export default function Organize() {
  const {
    action,
    id = "",
    type = "folder",
    name = "",
    parent,
  } = useLocalSearchParams<{
    action: string;
    id?: string;
    type?: string;
    name?: string;
    parent?: string;
  }>();
  const { t } = useLocale();
  const c = useTheme();
  const qc = useQueryClient();
  const [text, setText] = useState(name);
  const [busy, setBusy] = useState(false);
  const [destination, setDestination] = useState<string | undefined>();
  const moving = action === "move";
  // A folder made from this picker is where the item is going: open it.
  useEffect(() => {
    if (!moving) return;
    const open = (folder: string) => setDestination(folder);
    created.add(open);
    return () => void created.delete(open);
  }, [moving]);
  const q = useQuery({
    queryKey: ["library-destination", destination],
    queryFn: () =>
      api.request<LibraryData>(
        destination ? `library/${destination}/` : "library/",
      ),
    enabled: moving,
  });
  // The root's name is the server's Polish "Moje quizy"; Library calls it Library.
  const pathNames =
    q.data?.path.map((folder, index) =>
      index ? folder.name : t("Biblioteka", "Library"),
    ) ?? [];
  const folders =
    q.data?.items.filter(
      (item) =>
        item.type === "folder" &&
        item.folder_type === "regular" &&
        item.can_edit &&
        item.id !== id,
    ) ?? [];
  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      if (moving) {
        if (!q.data || !canMoveTo(q.data, { id, type, parent })) return;
        const target = q.data.path.at(-1)!.id;
        await api.post(
          `${type === "quiz" ? "quizzes" : type === "shortcut" ? "quiz-shortcuts" : "folders"}/${id}/move/`,
          type === "folder" ? { parent_id: target } : { folder_id: target },
        );
      } else if (action === "rename")
        await api.request(`folders/${id}/`, {
          method: "PATCH",
          body: JSON.stringify({ name: text.trim() }),
        });
      else {
        const folder = await api.post<{ id: string }>("folders/", {
          name: text.trim(),
          ...(parent ? { parent } : {}),
        });
        for (const listener of created) listener(folder.id);
      }
      await qc.invalidateQueries({ queryKey: ["library"] });
      await qc.invalidateQueries({ queryKey: ["library-destination"] });
      router.back();
    } catch (error) {
      notify(
        moving
          ? t("Nie przeniesiono", "Couldn’t Move Item")
          : action === "rename"
            ? t("Nie zmieniono nazwy", "Couldn’t Rename Folder")
            : t("Nie utworzono folderu", "Couldn’t Create Folder"),
        userError(error, t),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Stack.Screen
        options={{
          title: moving
            ? t("Przenieś do folderu", "Move to Folder")
            : action === "rename"
              ? t("Zmień nazwę folderu", "Rename Folder")
              : t("Nowy folder", "New Folder"),
          headerBackVisible: false,
          gestureEnabled: !busy,
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button disabled={busy} onPress={() => router.back()}>
          {t("Anuluj", "Cancel")}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {moving && Platform.OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            variant="prominent"
            tintColor={c.prominent}
            disabled={
              busy || !q.data || !canMoveTo(q.data, { id, type, parent })
            }
            onPress={save}
          >
            {t("Przenieś", "Move")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      {!moving ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel={
              action === "rename"
                ? t("Zapisz nazwę", "Save Name")
                : t("Utwórz folder", "Create Folder")
            }
            disabled={
              busy ||
              !text.trim() ||
              (action === "rename" && text.trim() === name)
            }
            onPress={save}
          >
            {action === "rename" ? t("Zapisz", "Save") : t("Utwórz", "Create")}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Screen
        scroll={!moving}
        footer={
          moving && Platform.OS !== "ios" ? (
            <Button
              disabled={
                busy || !q.data || !canMoveTo(q.data, { id, type, parent })
              }
              onPress={save}
            >
              {t("Przenieś tutaj", "Move Here")}
            </Button>
          ) : Platform.OS !== "ios" ? (
            <Button
              disabled={
                busy ||
                !text.trim() ||
                (action === "rename" && text.trim() === name)
              }
              onPress={save}
            >
              {action === "rename"
                ? t("Zapisz nazwę", "Save Name")
                : t("Utwórz folder", "Create Folder")}
            </Button>
          ) : undefined
        }
      >
        {moving ? (
          q.isPending ? (
            <Loading />
          ) : q.error ? (
            <ErrorState error={q.error} retry={() => void q.refetch()} />
          ) : (
            <FlatList
              data={folders}
              keyExtractor={(item) => item.id}
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={{ padding: 20 }}
              ListHeaderComponent={
                <View style={{ gap: 8, paddingBottom: 8 }}>
                  <Text
                    style={{
                      color: c.muted,
                      fontSize: 13,
                      paddingHorizontal: 4,
                    }}
                  >
                    {t(`Przenosisz „${name}” do:`, `Moving “${name}” to:`)}
                  </Text>
                  <Collection>
                    <CollectionRow
                      title={pathNames.at(-1) ?? ""}
                      detail={
                        pathNames.length > 1 ? pathNames.join(" / ") : undefined
                      }
                      kind="folder"
                      disclosure={false}
                      onPress={() => {}}
                    />
                    {destination ? (
                      <>
                        <CollectionDivider />
                        <CollectionRow
                          title={t("Folder nadrzędny", "Parent Folder")}
                          symbol="arrow.turn.left.up"
                          ionicon="return-up-back"
                          disclosure={false}
                          onPress={() =>
                            setDestination(q.data?.path.at(-2)?.id)
                          }
                        />
                      </>
                    ) : null}
                    {q.data?.can_create_folder ? (
                      <>
                        <CollectionDivider />
                        <CollectionRow
                          title={t("Nowy folder", "New Folder")}
                          symbol="folder.badge.plus"
                          ionicon="add-circle-outline"
                          disclosure={false}
                          onPress={() =>
                            router.push({
                              pathname: "/organize",
                              params: {
                                action: "create",
                                parent: q.data?.path.at(-1)?.id,
                              },
                            })
                          }
                        />
                      </>
                    ) : null}
                  </Collection>
                  <Text
                    accessibilityRole="header"
                    style={{
                      color: c.muted,
                      fontSize: 17,
                      fontWeight: "600",
                      paddingHorizontal: 16,
                      paddingTop: 16,
                      // Material 3 list subheader.
                      ...(Platform.OS === "android"
                        ? {
                            color: c.primary,
                            fontSize: 14,
                            fontWeight: "500" as const,
                          }
                        : null),
                    }}
                  >
                    {t("Foldery", "Folders")}
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <View
                  style={{
                    backgroundColor: c.surface,
                    borderTopLeftRadius: index === 0 ? 14 : 0,
                    borderTopRightRadius: index === 0 ? 14 : 0,
                    borderBottomLeftRadius:
                      index === folders.length - 1 ? 14 : 0,
                    borderBottomRightRadius:
                      index === folders.length - 1 ? 14 : 0,
                    overflow: "hidden",
                  }}
                >
                  {index ? <CollectionDivider /> : null}
                  <CollectionRow
                    title={item.name}
                    kind="folder"
                    onPress={() => setDestination(item.id)}
                  />
                </View>
              )}
              ListEmptyComponent={
                <Label muted>
                  {t(
                    "Brak podfolderów w tym miejscu.",
                    "There are no subfolders here.",
                  )}
                </Label>
              }
            />
          )
        ) : (
          <Field
            label={t("Nazwa folderu", "Folder name")}
            value={text}
            onChangeText={setText}
            autoFocus
            autoCorrect={false}
            spellCheck={false}
          />
        )}
      </Screen>
    </>
  );
}
