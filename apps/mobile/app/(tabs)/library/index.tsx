import {
  sortLibrary,
  type LibraryData,
  type LibraryItem as Item,
  type LibrarySort,
} from "@testownik/core/quiz/library";
import type { QuizMetadata, SharedQuiz } from "@testownik/core/quiz/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, Platform, View } from "react-native";
import type { SearchBarCommands } from "react-native-screens";

import type { LibraryMove } from "../../../modules/library-drag/src/LibraryDrag.types";
import {
  headerMenus,
  type MenuAction,
} from "../../../src/components/header-action";
import LibraryContent from "../../../src/components/library/LibraryContent";
import type {
  LibrarySection,
  SwipeAction,
} from "../../../src/components/library/types";
import { useConfirm } from "../../../src/components/ui";
import { notify } from "../../../src/lib/alerts";
import { WEB_URL, api, listOf } from "../../../src/lib/api";
import {
  createTrashDeletion,
  trashItems,
} from "../../../src/lib/library-trash";
import { openedDate, questionCount } from "../../../src/lib/collection-copy";
import { haptics } from "../../../src/lib/haptics";
import { useLocale } from "../../../src/lib/locale";
import { searchQuizzes, searchSections } from "../../../src/lib/quiz-search";
import { useSession } from "../../../src/lib/session";
import { storage } from "../../../src/lib/storage";
import { useTheme } from "../../../src/lib/theme";
import { errorKind, userError } from "../../../src/lib/user-error";

const sorts: LibrarySort[] = ["recent", "newest", "oldest", "az", "za"];
const accessFailure = (error: unknown) =>
  ["signIn", "notFound", "forbidden"].includes(errorKind(error));

export default function Library() {
  const [client] = useState(() => api.forSession());
  const { folder, kind } = useLocalSearchParams<{
    folder?: string;
    kind?: string;
  }>();
  const s = useSession();
  const c = useTheme();
  const confirm = useConfirm();
  const { t, language } = useLocale();
  const qc = useQueryClient();
  const searchBar = useRef<SearchBarCommands>(null);
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const [sort, setSort] = useState<LibrarySort>("recent");
  useEffect(() => {
    void storage
      .read<LibrarySort>("library-sort", "recent")
      .then((value) => {
        if (sorts.includes(value)) setSort(value);
      })
      .catch(() => {});
  }, []);

  const result = useQuery<LibraryData>({
    queryKey: ["library", folder],
    networkMode: "always",
    refetchOnReconnect: true,
    queryFn: () =>
      client.request<LibraryData>(folder ? `library/${folder}/` : "library/"),
  });
  // Keep transient failures readable, but stop presenting revoked results.
  const resultData = accessFailure(result.error) ? undefined : result.data;
  // At the top level the library also lists quizzes shared with you and
  // recently opened ones; the folders stay visible so you can drop into them.
  const [scope, setScope] = useState<"library" | "shared" | "recent">(
    "library",
  );
  const listing = folder ? "library" : scope;
  const shared = useQuery({
    queryKey: ["library-shared", s.user?.id],
    networkMode: "always",
    refetchOnReconnect: true,
    queryFn: async () =>
      listOf(await client.request<SharedQuiz[]>("shared-quizzes/")),
    enabled: listing === "shared",
  });
  const recent = useQuery({
    queryKey: ["library-recent", s.user?.id],
    networkMode: "always",
    refetchOnReconnect: true,
    queryFn: async () =>
      listOf(
        await client.request<QuizMetadata[]>("last-used-quizzes/?limit=30"),
      ),
    enabled: listing === "recent",
  });
  const sharedData = accessFailure(shared.error) ? undefined : shared.data;
  const recentData = accessFailure(recent.error) ? undefined : recent.data;
  const asItem = (quiz: QuizMetadata): Item => ({
    id: quiz.id,
    name: quiz.title,
    type: "quiz",
    can_edit: !!quiz.can_edit,
    can_manage: !!s.user && quiz.creator?.id === s.user.id,
    description: quiz.description,
    question_count: quiz.question_count,
    created_at: quiz.created_at,
    last_used_at: quiz.last_used_at,
  });
  const extras: Item[] =
    listing === "shared"
      ? [
          ...new Map(
            (sharedData ?? [])
              // The endpoint also lists your own quizzes you shared with others
              // (as the web does, Shared is only what others shared with you).
              .filter((entry) => entry.quiz.creator?.id !== s.user?.id)
              .map((entry) => [entry.quiz.id, asItem(entry.quiz)]),
          ).values(),
        ]
      : listing === "recent"
        ? (recentData ?? []).map(asItem)
        : [];
  const extraQuery = listing === "shared" ? shared : recent;
  // Offline, the quizzes kept on this device are still there to study.
  const showSavedFallback =
    !folder && !!result.error && !resultData && !accessFailure(result.error);
  const saved = useQuery({
    queryKey: ["offline", s.user?.id],
    queryFn: () => s.library!.read(),
    enabled: !!s.library && showSavedFallback,
    networkMode: "always",
  });
  const savedItems: Item[] = showSavedFallback
    ? Object.values(saved.data?.quizzes ?? {}).map((quiz) =>
        asItem({
          ...quiz,
          question_count: quiz.questions.length,
          created_at: "",
          updated_at: "",
          last_used_at: null,
        }),
      )
    : [];
  const [searchAccessDenied, setSearchAccessDenied] = useState(false);
  useLayoutEffect(
    () =>
      qc.getQueryCache().subscribe((event) => {
        if (
          event.type !== "updated" ||
          event.query.queryKey[0] !== "library-search" ||
          event.query.queryKey[1] !== s.user?.id
        )
          return;
        if (event.action.type === "error" && accessFailure(event.action.error))
          setSearchAccessDenied(true);
        else if (
          event.action.type === "success" &&
          !event.action.manual &&
          event.query.queryKey[2] === search &&
          event.query.isActive()
        )
          setSearchAccessDenied(false);
      }),
    [qc, s.user?.id, search],
  );
  const found = useQuery({
    queryKey: ["library-search", s.user?.id, search],
    networkMode: "always",
    refetchOnReconnect: true,
    queryFn: () => searchQuizzes(search),
    enabled: !!search,
    placeholderData: (previous, previousQuery) =>
      searchAccessDenied || accessFailure(previousQuery?.state.error)
        ? undefined
        : previous,
  });

  const foundData = accessFailure(found.error) ? undefined : found.data;
  const folderName = (type: string | undefined, name: string) =>
    type === "archive"
      ? t("Archiwum", "Archive")
      : type === "trash"
        ? t("Kosz", "Trash")
        : name;
  const refreshLibrary = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["library"] }),
      qc.invalidateQueries({ queryKey: ["library-destination"] }),
      qc.invalidateQueries({ queryKey: ["recent"] }),
      qc.invalidateQueries({ queryKey: ["offline"] }),
    ]);

  const moveQuiz = (item: Item, destination: "root" | "trash" | "archive") =>
    perform(async () => {
      if (destination === "archive")
        await client.post(`quizzes/${item.id}/move-to-archive/`);
      else {
        const root = await client.request<LibraryData>("library/");
        const folderId =
          destination === "root"
            ? root.path[0]?.id
            : root.items.find((entry) => entry.folder_type === "trash")?.id;
        if (!folderId)
          throw new Error(
            t(
              "Nie znaleziono folderu docelowego. Odśwież bibliotekę i spróbuj ponownie.",
              "Destination not found. Refresh your library and try again.",
            ),
          );
        // Moving to trash is idempotent; a repeated DELETE would permanently delete.
        await client.post(`quizzes/${item.id}/move/`, { folder_id: folderId });
        // A trashed quiz can't be studied, so it leaves this device and Study.
        if (destination === "trash")
          await s.library?.discard(item.id).catch(() => undefined);
      }
    });

  const moving = useRef(false);
  const [isMoving, setIsMoving] = useState(false);
  // Every quiz can be dragged (at least as a link); drops decide what happens.
  const canDrag = (item: Item) =>
    !isMoving &&
    (item.type === "quiz" || (item.can_edit && item.folder_type === "regular"));
  const own = (item: Item) =>
    item.type === "folder" || (!!item.can_manage && !item.shortcut_id);
  // Folders accept anything; Archive and Trash only take your own quizzes.
  const canDrop = (item: Item, source?: Item) =>
    !isMoving &&
    item.type === "folder" &&
    (item.folder_type === "regular"
      ? item.can_edit
      : (item.folder_type === "archive" || item.folder_type === "trash") &&
        (!source || (source.type === "quiz" && own(source))));
  async function perform(
    action: () => Promise<unknown>,
    failureTitle = t("Nie udało się przenieść", "Couldn’t Move Item"),
  ) {
    if (moving.current) return;
    moving.current = true;
    setIsMoving(true);
    try {
      await action();
      haptics.success();
      await refreshLibrary();
    } catch (error) {
      haptics.error();
      notify(failureTitle, userError(error, t));
      // A multi-step action may have partly succeeded.
      void refreshLibrary();
    } finally {
      moving.current = false;
      setIsMoving(false);
    }
  }
  // Someone else's quiz can't move into your folders: keep a shortcut or a copy.
  const offerForeign = (source: Item, target: Item) =>
    Alert.alert(
      t(
        `Dodać „${source.name}” do folderu „${target.name}”?`,
        `Add “${source.name}” to “${target.name}”?`,
      ),
      t(
        "Ten quiz należy do kogoś innego. Skrót zawsze pokazuje aktualną wersję, a kopia jest Twoja i możesz ją edytować.",
        "This quiz belongs to someone else. A shortcut always shows the latest version; a copy is yours to edit.",
      ),
      [
        {
          text: t("Dodaj skrót", "Add Shortcut"),
          onPress: () =>
            void perform(
              () =>
                client.post("quiz-shortcuts/", {
                  quiz_id: source.id,
                  folder_id: target.id,
                }),
              t("Nie dodano skrótu", "Couldn’t Add Shortcut"),
            ),
        },
        {
          text: t("Utwórz kopię", "Make a Copy"),
          onPress: () =>
            void perform(
              async () => {
                const copy = await client.post<{ id: string }>(
                  `quizzes/${source.id}/copy/`,
                );
                await client.post(`quizzes/${copy.id}/move/`, {
                  folder_id: target.id,
                });
              },
              t("Nie utworzono kopii", "Couldn’t Make a Copy"),
            ),
        },
        { text: t("Anuluj", "Cancel"), style: "cancel" },
      ],
    );
  async function drop({ id, type, destination }: LibraryMove) {
    const pool = [...(resultData?.items ?? []), ...extras];
    const source =
      type === "shortcut"
        ? pool.find((item) => item.shortcut_id === id)
        : pool.find((item) => item.id === id && item.type === type);
    const target = resultData?.items.find((item) => item.id === destination);
    if (moving.current || !source || !target || id === destination) return;
    if (!canDrag(source) || !canDrop(target, source)) return;
    if (source.shortcut_id)
      return perform(() =>
        client.post(`quiz-shortcuts/${source.shortcut_id}/move/`, {
          folder_id: destination,
        }),
      );
    if (!own(source)) return offerForeign(source, target);
    if (target.folder_type === "trash") return trashQuiz(source);
    return perform(() =>
      target.folder_type === "archive"
        ? client.post(`quizzes/${id}/move-to-archive/`)
        : type === "quiz"
          ? client.post(`quizzes/${id}/move/`, { folder_id: destination })
          : client.post(`folders/${id}/move/`, { parent_id: destination }),
    );
  }
  const removeShortcut = (item: Item) =>
    perform(
      () => client.delete(`quiz-shortcuts/${item.shortcut_id}/`),
      t("Nie usunięto skrótu", "Couldn’t Remove Shortcut"),
    );

  const organize = (item: Item, action: "move" | "rename") =>
    router.push({
      pathname: "/organize",
      params: {
        action,
        id: item.shortcut_id ?? item.id,
        type: item.shortcut_id ? "shortcut" : item.type,
        name: item.name,
        parent: folder ?? resultData?.path.at(-1)?.id,
      },
    });
  // Trash is recoverable (Restore), so it needs no confirmation.
  const trashQuiz = (item: Item) => moveQuiz(item, "trash");
  // Deleting from the trash is final, so this one does ask.
  const deleteForever = (item: Item) =>
    confirm(
      t("Usunąć quiz na zawsze?", "Delete Quiz Permanently?"),
      t(
        `„${item.name}” zostanie trwale usunięty. Tego nie można cofnąć.`,
        `“${item.name}” will be deleted permanently. This can’t be undone.`,
      ),
      () =>
        perform(
          () => client.delete(`quizzes/${item.id}/`),
          t("Nie udało się usunąć", "Couldn’t Delete Quiz"),
        ),
      { action: t("Usuń", "Delete") },
    );
  const trashed = trashItems(resultData?.items);
  const emptyTrash = () => {
    const removeApproved = createTrashDeletion(
      trashed,
      () => qc.getQueryData<LibraryData>(["library", folder])?.items,
      (id) => client.delete(`quizzes/${id}/`),
    );
    confirm(
      t("Opróżnić kosz?", "Empty Trash?"),
      t(
        `Quizy w koszu (${trashed.length}) zostaną trwale usunięte. Tego nie można cofnąć.`,
        `${trashed.length === 1 ? "1 quiz" : `${trashed.length} quizzes`} will be deleted permanently. This can’t be undone.`,
      ),
      () =>
        perform(
          removeApproved,
          t("Nie udało się opróżnić kosza", "Couldn’t Empty Trash"),
        ),
      { action: t("Opróżnij kosz", "Empty Trash") },
    );
  };
  const deleteFolder = (item: Item) =>
    confirm(
      t("Usunąć folder?", "Delete This Folder?"),
      t(
        "Folder i jego zawartość zostaną trwale usunięte.",
        "This permanently deletes the folder and its contents.",
      ),
      () =>
        perform(
          () => client.delete(`folders/${item.id}/`),
          t("Nie usunięto folderu", "Couldn’t Delete Folder"),
        ),
      { action: t("Usuń folder", "Delete Folder") },
    );
  const openQuiz = (id: string) =>
    router.push({ pathname: "/quiz/[id]", params: { id } });
  const quizActions = {
    open: openQuiz,
    edit: (id: string) => router.push({ pathname: "/editor", params: { id } }),
    share: (id: string) => router.push({ pathname: "/share", params: { id } }),
  };
  const restorable = (item: Item) => !!(item.deleted_at || item.archived_at);
  const editableFolder = (item: Item) =>
    item.type === "folder" && item.can_edit && item.folder_type === "regular";

  const menu = (item: Item): MenuAction[][] => {
    if (item.type === "folder")
      return editableFolder(item)
        ? [
            [
              {
                title: t("Zmień nazwę", "Rename"),
                icon: "pencil",
                onPress: () => organize(item, "rename"),
              },
              {
                title: t("Przenieś do folderu", "Move to Folder"),
                icon: "folder",
                onPress: () => organize(item, "move"),
              },
            ],
            [
              {
                title: t("Usuń folder", "Delete Folder"),
                icon: "trash",
                destructive: true,
                onPress: () => deleteFolder(item),
              },
            ],
          ]
        : [];
    // A trashed quiz can't be opened, only brought back or removed for good.
    if (item.deleted_at && item.can_manage)
      return [
        [
          {
            title: t("Przywróć do biblioteki", "Restore to Library"),
            icon: "arrow.uturn.backward",
            onPress: () => moveQuiz(item, "root"),
          },
        ],
        [
          {
            title: t("Usuń na zawsze", "Delete Permanently"),
            icon: "trash",
            destructive: true,
            onPress: () => deleteForever(item),
          },
        ],
      ];
    return [
      [
        {
          title: t("Ucz się", "Study"),
          icon: "play",
          onPress: () => openQuiz(item.id),
        },
        ...(item.can_edit
          ? [
              {
                title: t("Edytuj", "Edit"),
                icon: "pencil" as const,
                onPress: () => quizActions.edit(item.id),
              },
              {
                title: t("Udostępnij", "Share"),
                icon: "square.and.arrow.up" as const,
                onPress: () => quizActions.share(item.id),
              },
            ]
          : []),
      ],
      item.shortcut_id
        ? [
            {
              title: t("Przenieś do folderu", "Move to Folder"),
              icon: "folder",
              onPress: () => organize(item, "move"),
            },
            {
              title: t("Usuń skrót", "Remove Shortcut"),
              icon: "minus.circle",
              destructive: true,
              onPress: () => void removeShortcut(item),
            },
          ]
        : [],
      own(item)
        ? [
            {
              title: t("Przenieś do folderu", "Move to Folder"),
              icon: "folder",
              onPress: () => organize(item, "move"),
            },
            restorable(item)
              ? {
                  title: t("Przywróć do biblioteki", "Restore to Library"),
                  icon: "arrow.uturn.backward",
                  onPress: () => moveQuiz(item, "root"),
                }
              : {
                  title: t("Archiwizuj", "Archive"),
                  icon: "archivebox",
                  onPress: () => moveQuiz(item, "archive"),
                },
          ]
        : [],
      item.can_manage && !item.deleted_at
        ? [
            {
              title: t("Przenieś do kosza", "Move to Trash"),
              icon: "trash",
              destructive: true,
              onPress: () => trashQuiz(item),
            },
          ]
        : [],
    ];
  };
  const swipe = (
    item: Item,
  ): { leading: SwipeAction[]; trailing: SwipeAction[] } => {
    const move: SwipeAction = {
      title: t("Przenieś", "Move"),
      icon: "folder",
      tint: c.muted,
      onPress: () => organize(item, "move"),
    };
    if (item.type === "folder")
      return editableFolder(item)
        ? {
            // Leading swipes would compete with the full-width back gesture
            // inside folders, so every action sits on the trailing edge.
            leading: [],
            trailing: [
              {
                title: t("Usuń", "Delete"),
                icon: "trash",
                destructive: true,
                tint: c.destructive,
                onPress: () => deleteFolder(item),
              },
              move,
            ],
          }
        : { leading: [], trailing: [] };
    if (item.shortcut_id)
      return {
        leading: [],
        trailing: [
          {
            title: t("Usuń skrót", "Remove"),
            icon: "minus.circle",
            tint: c.destructive,
            onPress: () => void removeShortcut(item),
          },
          move,
        ],
      };
    if (!item.can_manage) return { leading: [], trailing: [] };
    if (item.deleted_at)
      return {
        leading: [],
        trailing: [
          // Not a destructive role: the row must stay until the confirmation.
          {
            title: t("Usuń", "Delete"),
            icon: "trash",
            tint: c.destructive,
            onPress: () => deleteForever(item),
          },
          {
            title: t("Przywróć", "Restore"),
            icon: "arrow.uturn.backward",
            tint: c.primary,
            onPress: () => moveQuiz(item, "root"),
          },
        ],
      };
    return {
      leading: [],
      trailing: [
        ...(item.deleted_at
          ? []
          : [
              {
                title: t("Kosz", "Trash"),
                icon: "trash" as const,
                destructive: true,
                tint: c.destructive,
                onPress: () => trashQuiz(item),
              },
            ]),
        restorable(item)
          ? {
              title: t("Przywróć", "Restore"),
              icon: "arrow.uturn.backward",
              tint: c.primary,
              onPress: () => moveQuiz(item, "root"),
            }
          : {
              title: t("Archiwizuj", "Archive"),
              icon: "archivebox",
              tint: c.caution,
              onPress: () => moveQuiz(item, "archive"),
            },
        move,
      ],
    };
  };

  const sorted = sortLibrary(resultData?.items ?? [], sort, language);
  const special = (item: Item) =>
    ["archive", "trash"].includes(item.folder_type ?? "");
  const folders = sorted.filter(
    (item) => item.type === "folder" && !special(item),
  );
  const sections = (
    (listing === "library" && savedItems.length
      ? [
          {
            key: "quizzes",
            title: t("Na tym urządzeniu", "On This Device"),
            items: savedItems,
          },
        ]
      : listing === "library"
        ? [
            { key: "folders", title: t("Foldery", "Folders"), items: folders },
            {
              key: "quizzes",
              title: t("Quizy", "Quizzes"),
              items: sorted.filter((item) => item.type === "quiz"),
            },
            {
              key: "storage",
              title: t("Zarządzaj", "Manage"),
              items: sorted.filter(
                (item) => item.type === "folder" && special(item),
              ),
            },
          ]
        : [
            { key: "folders", title: t("Foldery", "Folders"), items: folders },
            {
              key: "quizzes",
              title:
                listing === "shared"
                  ? t("Udostępnione Tobie", "Shared with You")
                  : t("Ostatnio otwierane", "Recently Opened"),
              items: extras,
            },
          ]) satisfies LibrarySection[]
  ).filter(
    (section) =>
      section.items.length &&
      // An empty Shared/Recent tab explains itself instead of listing folders.
      (listing === "library" || extras.length),
  );

  const sortLabels: Record<LibrarySort, string> = {
    recent: t("Ostatnio używane", "Recently Used"),
    newest: t("Najnowsze", "Newest"),
    oldest: t("Najstarsze", "Oldest"),
    az: t("Nazwa A–Z", "Name A–Z"),
    za: t("Nazwa Z–A", "Name Z–A"),
  };

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Title large={!folder} largeStyle={{ color: c.text }}>
        {folder
          ? folderName(kind, resultData?.path.at(-1)?.name ?? "Folder")
          : t("Biblioteka", "Library")}
      </Stack.Title>
      <Stack.Screen
        options={{
          // An opaque navigation background hides large titles with search on current iOS.
          headerStyle: {
            backgroundColor: Platform.OS === "ios" ? "transparent" : c.surface,
          },
          headerSearchBarOptions:
            Platform.OS === "web"
              ? undefined
              : {
                  ref: searchBar,
                  placeholder: t("Szukaj quizów", "Search Quizzes"),
                  autoCapitalize: "none",
                  hideWhenScrolling: false,
                  placement: "automatic",
                  onChangeText: (event) => setQuery(event.nativeEvent.text),
                  onSearchButtonPress: () => searchBar.current?.blur(),
                  onCancelButtonPress: () => setQuery(""),
                  onClose: () => {
                    setQuery("");
                    setSearch("");
                  },
                },
          ...headerMenus(
            // eslint-disable-next-line react-hooks/refs -- This only stores menu callbacks; the move lock is read after confirmation.
            [
              {
                label: t("Sortuj", "Sort"),
                icon: "arrow.up.arrow.down",
                fallbackIcon: "sort",
                sections: [
                  sorts.map((value) => ({
                    title: sortLabels[value],
                    selected: sort === value,
                    onPress: () => {
                      haptics.selection();
                      setSort(value);
                      void storage.write("library-sort", value).catch(() => {});
                    },
                  })),
                ],
              },
              ...(kind === "trash"
                ? trashed.length
                  ? [
                      {
                        label: t("Opcje kosza", "Trash Options"),
                        icon: "ellipsis" as const,
                        sections: [
                          [
                            {
                              title: t("Opróżnij kosz", "Empty Trash"),
                              icon: "trash" as const,
                              destructive: true,
                              onPress: () => emptyTrash(),
                              disabled: isMoving,
                            },
                          ],
                        ],
                      },
                    ]
                  : []
                : [
                    {
                      label: t("Dodaj do biblioteki", "Add to Library"),
                      icon: "plus" as const,
                      fallbackIcon: "add" as const,
                      sections: (
                        [
                          [
                            {
                              title: t("Nowy quiz", "New Quiz"),
                              icon: "square.and.pencil",
                              onPress: () => router.push("/editor"),
                            },
                            {
                              title: t("Importuj quiz", "Import Quiz"),
                              icon: "square.and.arrow.down",
                              onPress: () => router.push("/import"),
                            },
                          ],
                          resultData?.can_create_folder
                            ? [
                                {
                                  title: t("Nowy folder", "New Folder"),
                                  icon: "folder.badge.plus",
                                  onPress: () =>
                                    router.push({
                                      pathname: "/organize",
                                      params: {
                                        action: "create",
                                        ...(folder ? { parent: folder } : {}),
                                      },
                                    }),
                                },
                              ]
                            : [],
                        ] satisfies MenuAction[][]
                      ).filter((group) => group.length),
                    },
                  ]),
            ],
            t,
          ),
        }}
      />
      <LibraryContent
        sections={sections}
        searching={!!query.trim()}
        searchSections={
          foundData && search ? searchSections(foundData, t, language) : []
        }
        searchLoading={query.trim() !== search || found.isFetching}
        searchError={found.error}
        loading={
          result.isLoading || (listing !== "library" && extraQuery.isLoading)
        }
        error={
          result.error ?? (listing !== "library" ? extraQuery.error : null)
        }
        scope={
          folder
            ? undefined
            : {
                value: scope,
                options: [
                  { value: "library", label: t("Moje", "Mine") },
                  { value: "shared", label: t("Udostępnione", "Shared") },
                  { value: "recent", label: t("Ostatnie", "Recent") },
                ],
                onChange: (value) => {
                  haptics.selection();
                  setScope(value as typeof scope);
                },
              }
        }
        link={(item) =>
          item.type === "folder"
            ? `${WEB_URL}/quizzes?folder=${item.id}`
            : `${WEB_URL}/quiz/${item.id}${item.shortcut_id ? `?shortcut=${item.shortcut_id}` : ""}`
        }
        empty={
          kind === "trash"
            ? {
                title: t("Kosz jest pusty", "Trash Is Empty"),
                symbol: "trash",
                description: t(
                  "Usunięte quizy znajdziesz tutaj. Możesz przywrócić je do biblioteki.",
                  "Deleted quizzes appear here. You can restore them to your library.",
                ),
              }
            : kind === "archive"
              ? {
                  title: t(
                    "Brak zarchiwizowanych quizów",
                    "No Archived Quizzes",
                  ),
                  symbol: "archivebox",
                  description: t(
                    "Archiwizuj quizy, do których chcesz wrócić później. Zachowasz ich treść i postępy.",
                    "Archive quizzes to return to later. Their content and progress are kept.",
                  ),
                }
              : listing === "shared"
                ? {
                    title: t("Nic nie udostępniono", "Nothing Shared Yet"),
                    symbol: "person.2",
                    description: t(
                      "Quizy, które inni Ci udostępnią, pojawią się tutaj.",
                      "Quizzes other people share with you appear here.",
                    ),
                  }
                : listing === "recent"
                  ? {
                      title: t("Brak ostatnich quizów", "No Recent Quizzes"),
                      symbol: "clock",
                      description: t(
                        "Quizy, które otworzysz, pojawią się tutaj.",
                        "Quizzes you open appear here.",
                      ),
                    }
                  : folder
                    ? {
                        title: t(
                          "Ten folder jest pusty",
                          "This Folder Is Empty",
                        ),
                        symbol: "folder",
                        description: t(
                          "Przeciągnij tu quiz albo dodaj nowy przyciskiem +.",
                          "Drag a quiz here or add a new one with the + button.",
                        ),
                      }
                    : {
                        title: t(
                          "Tu zaczyna się Twoja biblioteka",
                          "Your Library Starts Here",
                        ),
                        symbol: "books.vertical",
                        description: t(
                          "Dodaj własny quiz lub zaimportuj quiz przyciskiem +.",
                          "Add your own quiz or import one using the + button.",
                        ),
                      }
        }
        moving={isMoving}
        refresh={() =>
          Promise.all([
            result.refetch(),
            listing !== "library" ? extraQuery.refetch() : null,
            search ? found.refetch() : null,
          ])
        }
        retry={() =>
          void (query.trim()
            ? found.refetch()
            : result.error || listing === "library"
              ? result.refetch()
              : extraQuery.refetch())
        }
        name={(item) => folderName(item.folder_type, item.name)}
        detail={(item) =>
          item.type === "folder"
            ? undefined
            : [
                item.shortcut_id ? t("Skrót", "Shortcut") : null,
                questionCount(item.question_count ?? undefined, language),
                openedDate(item.last_used_at, language),
              ]
                .filter(Boolean)
                .join(" · ") ||
              item.description ||
              undefined
        }
        open={(item) =>
          item.type === "folder"
            ? router.push({
                pathname: "/library/[folder]",
                params: {
                  folder: item.id,
                  kind: item.folder_type ?? "regular",
                },
              })
            : openQuiz(item.id)
        }
        menu={menu}
        swipe={swipe}
        canDrag={canDrag}
        canDrop={canDrop}
        drop={(move) => void drop(move)}
        quizActions={quizActions}
        backToLibrary={
          folder && (resultData?.path.length ?? 0) > 2
            ? () => router.dismissTo("/library")
            : undefined
        }
        query={query}
        setQuery={setQuery}
      />
    </View>
  );
}
