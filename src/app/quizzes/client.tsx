"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArchiveIcon,
  FolderIcon,
  FolderXIcon,
  ImportIcon,
  LayersPlus,
  LibraryIcon,
  Link2Icon,
  LoaderCircleIcon,
  MessageCircleQuestionMarkIcon,
  MessageCircleXIcon,
  NotepadTextIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { startTransition, useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import {
  DEFAULT_LIBRARY_SORT_KEY,
  compareFoldersByLibrarySort,
  compareQuizzesByLibrarySort,
} from "@/components/quiz/library-sort";
import type { LibrarySortKey } from "@/components/quiz/library-sort";
import { QuizzesLibrary } from "@/components/quiz/quiz-library";
import { QuizSort } from "@/components/quiz/quiz-sort";
import { ShareQuizDialog } from "@/components/quiz/share-quiz-dialog/share-quiz-dialog";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserFolders, useUserLibrary } from "@/hooks/use-folders";
import { useSharedQuizzes, useUserQuizzes } from "@/hooks/use-quizzes";
import { PermissionAction } from "@/lib/auth/permissions";
import { prepareQuizForDownload } from "@/lib/quiz-download";
import { getFolderService, getQuizService } from "@/services";
import type {
  Folder,
  Library,
  LibraryItem,
  QuizBase,
  QuizMetadata,
  SharedQuiz,
} from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";

interface QuizzesPageContentProps {
  userId?: string;
}

const escapeRegExp = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

function QuizzesPageContent({ userId }: QuizzesPageContentProps) {
  const { checkPermission } = useContext(AppContext);
  const queryClient = useQueryClient();
  const canSearchInQuizzes = checkPermission(PermissionAction.SEARCH_IN_QUIZ);
  const canViewShared = checkPermission(PermissionAction.VIEW_SHARED_QUIZZES);
  const router = useRouter();

  const [newFolderInput, setNewFolderInput] = useState<string>("Nowy folder");
  const [isCreatingNewFolder, setIsCreatingNewFolder] = useState(false);
  const [renameFolderInput, setRenameFolderInput] = useState<string>("");
  const [isRenamingFolder, setIsRenamingFolder] = useState<boolean>(false);

  const {
    data: userQuizzes = [],
    isLoading: isLoadingUserQuizzes,
    error: userQuizzesError,
  } = useUserQuizzes();

  const {
    data: allSharedQuizzes = [],
    isLoading: isLoadingSharedQuizzes,
    error: sharedQuizzesError,
  } = useSharedQuizzes({
    enabled: canViewShared,
  });

  const {
    data: library,
    isLoading: isLoadingUserLibrary,
    error: userLibraryError,
  } = useUserLibrary();

  const {
    data: folders = [],
    isLoading: isLoadingUserFolders,
    error: userFoldersError,
  } = useUserFolders();

  const rootFolderId =
    library != null && !Array.isArray(library) ? library.path[0].id : undefined;
  const rootFolder =
    rootFolderId == null
      ? undefined
      : folders.find((folder) => folder.id === rootFolderId);

  const searchParameters = useSearchParams();
  const urlFolderId = searchParameters.get("folderId") ?? undefined;

  const activeFolderId = urlFolderId ?? rootFolderId;

  const { data: currentFolderContent, isLoading: isLoadingContents } = useQuery(
    {
      queryKey: ["folder-library", activeFolderId],
      queryFn: async () => {
        if (activeFolderId == null) {
          throw new Error("Brak aktywnego folderu");
        }

        return getFolderService().getLibraryById(activeFolderId);
      },
      enabled: activeFolderId != null,
      refetchOnWindowFocus: false,
    },
  );

  const foldersHistory = useMemo(() => {
    if (currentFolderContent?.path == null) {
      return [];
    }
    return currentFolderContent.path.slice(1) as Folder[];
  }, [currentFolderContent]);

  const handleNavigateToFolder = async (folderId: string) => {
    try {
      await queryClient.ensureQueryData({
        queryKey: ["folder-library", folderId],
        queryFn: async () => getFolderService().getLibraryById(folderId),
      });
      router.push(`?folderId=${folderId}`);
    } catch {
      router.push(`?folderId=${folderId}`);
    }
  };

  const handleNavigateToHistoryIndex = (index: number) => {
    const targetFolder = foldersHistory[index];
    router.push(`?folderId=${targetFolder.id}`);
  };

  const handleNavigateToRoot = () => {
    router.push("?");
  };

  const archiveFolder = folders.find(
    (folder) => folder.folder_type === "archive",
  );
  const archivedQuizzes = userQuizzes.filter((quiz) =>
    (archiveFolder?.quizzes ?? []).includes(quiz.id),
  );

  // Exclude displaying root and archive folder
  const userFolders = folders.filter((folder) => {
    return folder.folder_type !== "archive" && folder.id !== rootFolder?.id;
  });

  // Filter shared quizzes to get unique ones
  const sharedQuizzes = allSharedQuizzes.filter(
    (sq: SharedQuiz, index: number, self: SharedQuiz[]) =>
      index === self.findIndex((q) => q.quiz.id === sq.quiz.id) &&
      sq.quiz.creator?.id !== userId,
  );

  const loading =
    isLoadingUserQuizzes ||
    isLoadingSharedQuizzes ||
    isLoadingUserFolders ||
    isLoadingUserLibrary ||
    isLoadingContents;
  const error =
    userQuizzesError ??
    sharedQuizzesError ??
    userFoldersError ??
    userLibraryError;

  const [currentDialog, setCurrentDialog] = useState<{
    type:
      | "share"
      | "delete-quiz"
      | "create-folder"
      | "delete-folder"
      | "rename-folder"
      | null;
    quiz: QuizMetadata | null;
    folderId: string | null;
  }>({ type: null, quiz: null, folderId: null });
  const [sortKey, setSortKey] = useState<LibrarySortKey>(
    DEFAULT_LIBRARY_SORT_KEY,
  );
  const [searchValue, setSearchValue] = useState<string>("");

  const searchRegex = useMemo(() => {
    const trimmedValue = searchValue.trim();

    if (trimmedValue === "") {
      return null;
    }

    return new RegExp(escapeRegExp(trimmedValue), "i");
  }, [searchValue]);

  const sortedUserQuizzes: QuizMetadata[] = useMemo(
    () =>
      userQuizzes.toSorted((left, right) =>
        compareQuizzesByLibrarySort(left, right, sortKey),
      ),
    [sortKey, userQuizzes],
  );

  const sortedSharedQuizzes: SharedQuiz[] = useMemo(
    () =>
      sharedQuizzes.toSorted((left, right) =>
        compareQuizzesByLibrarySort(left, right, sortKey),
      ),
    [sharedQuizzes, sortKey],
  );

  const sortedArchivedQuizzes: QuizMetadata[] = useMemo(
    () =>
      archivedQuizzes.toSorted((left, right) =>
        compareQuizzesByLibrarySort(left, right, sortKey),
      ),
    [archivedQuizzes, sortKey],
  );

  const sortedFolders: Folder[] = useMemo(
    () =>
      userFolders.toSorted((left, right) =>
        compareFoldersByLibrarySort(left, right, sortKey),
      ),
    [sortKey, userFolders],
  );

  const filteredAllQuizzes: QuizMetadata[] = useMemo(
    () =>
      sortedUserQuizzes.filter((quiz) => searchRegex?.test(quiz.title) ?? true),
    [sortedUserQuizzes, searchRegex],
  );
  const filteredLibraryQuizzes: QuizMetadata[] = useMemo(
    () =>
      sortedUserQuizzes.filter(
        (quiz) =>
          quiz.creator?.id === userId &&
          (searchRegex?.test(quiz.title) ?? true) &&
          quiz.folder?.folder_type !== "archive",
      ),
    [searchRegex, sortedUserQuizzes, userId],
  );
  const filteredPublicQuizzes: QuizMetadata[] = useMemo(
    () =>
      sortedUserQuizzes.filter(
        (quiz) =>
          quiz.visibility === AccessLevel.PUBLIC &&
          (searchRegex?.test(quiz.title) ?? true),
      ),
    [searchRegex, sortedUserQuizzes],
  );

  const filteredSharedQuizzes: SharedQuiz[] = useMemo(
    () =>
      sortedSharedQuizzes.filter(
        (quiz) => searchRegex?.test(quiz.quiz.title) ?? true,
      ),
    [searchRegex, sortedSharedQuizzes],
  );

  const filteredArchivedQuizzes: QuizMetadata[] = useMemo(
    () =>
      sortedArchivedQuizzes.filter(
        (quiz) => searchRegex?.test(quiz.title) ?? true,
      ),
    [searchRegex, sortedArchivedQuizzes],
  );

  const libraryItems: LibraryItem[] = currentFolderContent?.items ?? [];

  if (typeof document !== "undefined") {
    document.title = "Twoje quizy - Testownik Solvro";
  }
  const handleShareQuiz = (quiz: QuizMetadata) => {
    setCurrentDialog({ type: "share", quiz, folderId: null });
  };

  const handleDeleteQuiz = (quiz: QuizMetadata) => {
    setCurrentDialog({ type: "delete-quiz", quiz, folderId: null });
  };

  const handleDeleteFolder = (folderId: string) => {
    setCurrentDialog({ type: "delete-folder", quiz: null, folderId });
  };

  const handleRenameFolder = (folderId: string) => {
    const folderToRename = folders.find((folder) => folder.id === folderId);
    if (folderToRename == null) {
      return;
    }

    setRenameFolderInput(folderToRename.name);
    setCurrentDialog({ type: "rename-folder", quiz: null, folderId });
  };

  const handleArchiveQuiz = async (quiz: QuizMetadata) => {
    try {
      await getQuizService().archiveQuiz(quiz.id);
      void queryClient.invalidateQueries({ queryKey: ["user-quizzes"] });
      toast.success("Quiz został zarchiwizowany");
    } catch (error_) {
      console.error("Błd podczas archiwizacji quizu:", error_);
      toast.error("Nie udało się zarchiwizować quizu");
    }
  };

  const handleQuizMoveToFolder = async (quizId: string, folderId: string) => {
    const currentFolderQueryKey = ["folder-library", activeFolderId];

    try {
      queryClient.setQueryData(currentFolderQueryKey, (oldData: Library) => {
        return {
          ...oldData,
          items: oldData.items.filter(
            (item: LibraryItem) =>
              !(item.type === "quiz" && item.id === quizId),
          ),
        };
      });

      await getQuizService().moveQuizToFolder(quizId, folderId);

      void queryClient.invalidateQueries({ queryKey: ["user-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["user-library"] });
      void queryClient.invalidateQueries({ queryKey: currentFolderQueryKey });

      toast.success("Przeniesiono quiz do folderu");
    } catch (error_) {
      console.error("Błąd podczas przenoszenia quizu:", error_);
      toast.error("Nie udało się zapisać zmian w folderze.");

      void queryClient.invalidateQueries({ queryKey: currentFolderQueryKey });
    }
  };

  const handleFolderMoveToFolder = async (
    folderId: string,
    parentId: string,
  ) => {
    if (folderId === parentId) {
      return;
    }

    const currentFolderQueryKey = ["folder-library", activeFolderId];

    try {
      queryClient.setQueryData(currentFolderQueryKey, (oldData: Library) => {
        return {
          ...oldData,
          items: oldData.items.filter(
            (item: LibraryItem) =>
              !(item.type === "folder" && item.id === folderId),
          ),
        };
      });

      await getFolderService().moveFolder(folderId, parentId);

      void queryClient.invalidateQueries({ queryKey: ["user-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["user-library"] });
      void queryClient.invalidateQueries({ queryKey: currentFolderQueryKey });

      toast.success("Przeniesiono folder do folderu");
    } catch (error_) {
      console.error("Błąd podczas przenoszenia folderu:", error_);
      toast.error("Nie udało się zapisać zmian w folderze.");

      void queryClient.invalidateQueries({ queryKey: currentFolderQueryKey });
    }
  };

  const confirmDeleteQuiz = async () => {
    if (currentDialog.quiz === null) {
      return;
    }

    const quiz = currentDialog.quiz;

    try {
      await getQuizService().deleteQuiz(quiz.id);
      void queryClient.invalidateQueries({
        queryKey: ["user-quizzes"],
      });
      void queryClient.invalidateQueries({ queryKey: ["user-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["user-library"] });
      toast.success(`Quiz "${quiz.title}" został usunięty.`);
    } catch {
      toast.error("Nie uda��o się usunąć quizu.");
    }

    setCurrentDialog({ type: null, quiz: null, folderId: null });
  };

  const confirmDeleteFolder = async () => {
    if (currentDialog.folderId == null) {
      return;
    }

    const folderId = currentDialog.folderId;

    // Cannot delete root folder or archive
    if (folderId === rootFolder?.id || folderId === archiveFolder?.id) {
      return;
    }

    try {
      await getFolderService().deleteFolder(folderId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-folders"] }),
        queryClient.invalidateQueries({ queryKey: ["user-library"] }),
      ]);
      toast.success("Pomyślnie usunięto folder");
    } catch {
      toast.error("Nie udało się usunąć folderu");
    }

    setCurrentDialog({ type: null, quiz: null, folderId: null });
  };

  const handleDownloadQuiz = async (quiz: QuizMetadata) => {
    try {
      const fullQuiz = await getQuizService().getQuiz(quiz.id);
      // Create a downloadable version
      const downloadableQuiz = prepareQuizForDownload(fullQuiz);
      const url = window.URL.createObjectURL(
        new Blob([JSON.stringify(downloadableQuiz, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${fullQuiz.title}.json`);
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Nie udało się pobrać quizu.");
    }
  };

  const updateQuiz = (quiz: QuizBase) => {
    queryClient.setQueryData(
      ["user-quizzes"],
      (old: QuizMetadata[] | undefined) => {
        return old === undefined
          ? []
          : old.map((q) => (q.id === quiz.id ? { ...q, ...quiz } : q));
      },
    );
  };

  const handleResetFilters = () => {
    startTransition(() => {
      setSortKey(DEFAULT_LIBRARY_SORT_KEY);
      setSearchValue("");
    });
  };

  const handleCreateNewFolder = async () => {
    if (newFolderInput.trim().length === 0) {
      toast.error("Nazwa folderu nie może być pusta");
      return;
    }

    setIsCreatingNewFolder(true);

    const currentFolderQueryKey = ["folder-library", activeFolderId];
    const temporaryFolderId = `temp-${crypto.randomUUID()}`;

    try {
      if (rootFolder?.id == null) {
        toast.error("Wystąpił błąd podczas tworzenia folderu");
        return;
      }

      const targetParentId = activeFolderId ?? rootFolder.id;

      queryClient.setQueryData(currentFolderQueryKey, (oldData: Library) => {
        if (oldData.items.length === 0) {
          return oldData;
        }

        const optimisticFolder: Folder = {
          id: temporaryFolderId,
          name: newFolderInput.trim(),
          parent: targetParentId,
          quizzes: [],
          subfolders: [],
          created_at: new Date().toISOString(),
          folder_type: "regular",
        };

        return {
          ...oldData,
          items: [optimisticFolder, ...oldData.items],
        };
      });

      await getFolderService().createFolder({
        name: newFolderInput.trim(),
        parent: activeFolderId ?? rootFolder.id,
      });

      void queryClient.invalidateQueries({ queryKey: ["user-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["user-library"] });
      void queryClient.invalidateQueries({ queryKey: currentFolderQueryKey });

      toast.success("Utworzono nowy folder");
      setNewFolderInput("Nowy folder");
    } catch {
      toast.error("Wystąpił błąd podczas tworzenia folderu");
      void queryClient.invalidateQueries({ queryKey: currentFolderQueryKey });
    } finally {
      setIsCreatingNewFolder(false);
    }

    setCurrentDialog({
      type: null,
      quiz: null,
      folderId: null,
    });
  };

  const confirmFolderRename = async () => {
    if (currentDialog.folderId == null) {
      return;
    }

    const folderId = currentDialog.folderId;

    const originalFolder = folders.find((folder) => folder.id === folderId);
    if (originalFolder == null) {
      return;
    }

    setIsRenamingFolder(true);

    const folderToRename = {
      ...originalFolder,
      name: renameFolderInput,
    };

    try {
      await getFolderService().updateFolder(folderId, folderToRename);
      void queryClient.invalidateQueries({ queryKey: ["user-folders"] });
      void queryClient.invalidateQueries({ queryKey: ["user-library"] });
      toast.success("Pomyślnie zmieniono nazwę folderu");
    } catch {
      toast.error("Nie udało się zmienić nazwy folderu");
    }

    setIsRenamingFolder(false);
    setCurrentDialog({ type: null, quiz: null, folderId: null });
  };

  type TabKey = "all" | "library" | "public" | "shared" | "archive" | "trash";
  interface TabConfig {
    key: TabKey;
    titleLabel: string;
    description?: string;
    icon: ReactNode;
    showCreateButton?: boolean;
    showImportButton?: boolean;
    showSort?: boolean;
    library: () => LibraryItem[];
    isFilterActive: boolean;
    emptyState?: ReactNode;
    showBreadcrumb?: boolean;
  }

  const tabsConfig: TabConfig[] = [
    {
      key: "all",
      titleLabel: "Wszystkie",
      icon: <SettingsIcon className="size-6" />,
      library: () => {
        const items: LibraryItem[] = [...(library?.items ?? [])];
        const archivedQuizItems = filteredArchivedQuizzes.map((quiz) => ({
          id: quiz.id,
          type: "quiz" as const,
        })) as LibraryItem[];
        return [...items, ...archivedQuizItems];
      },
      isFilterActive:
        searchValue.trim().length > 0 &&
        sortedFolders.length === 0 &&
        filteredAllQuizzes.length === 0,
      showCreateButton: true,
      showImportButton: true,
      showSort: true,
      showBreadcrumb: true,
    },
    {
      key: "library",
      titleLabel: "Moja biblioteka",
      icon: <LibraryIcon className="size-6" />,
      library: () => {
        return libraryItems;
      },
      isFilterActive:
        searchValue.trim().length > 0 &&
        sortedFolders.length === 0 &&
        filteredLibraryQuizzes.length === 0,
      showCreateButton: true,
      showImportButton: true,
      showSort: true,
      showBreadcrumb: true,
    },
    {
      key: "public",
      titleLabel: "Publiczne",
      description: "Tu znajdziesz Twoje publiczne quizy.",
      icon: <MessageCircleQuestionMarkIcon className="size-6" />,
      library: () => {
        return filteredPublicQuizzes.map((quiz) => ({
          id: quiz.id,
          type: "quiz" as const,
        })) as LibraryItem[];
      },
      isFilterActive:
        searchValue.trim().length > 0 &&
        sortedFolders.length === 0 &&
        filteredPublicQuizzes.length === 0,
      showSort: true,
      emptyState: (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderXIcon />
            </EmptyMedia>
            <EmptyTitle>Brak publicznych quizów</EmptyTitle>
            <EmptyDescription>
              Żaden z Twoich quizów nie jest publiczny
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ),
    },
    {
      key: "shared",
      titleLabel: "Udostępnione dla mnie",
      description: "Tu znajdziesz quizy udostępnione Ci przez innych.",
      icon: <Link2Icon className="size-6" />,
      library: () => {
        return sortedSharedQuizzes.map((quiz) => ({
          id: quiz.quiz.id,
          type: "quiz" as const,
        })) as LibraryItem[];
      },
      isFilterActive:
        searchValue.trim().length > 0 &&
        sortedFolders.length === 0 &&
        filteredSharedQuizzes.length === 0,
      showSort: true,
      emptyState: (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderXIcon />
            </EmptyMedia>
            <EmptyTitle>Brak udostępnionych quizów</EmptyTitle>
            <EmptyDescription>
              Nikt nie udostępnił Ci żadnego quizu
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ),
    },
    {
      key: "archive",
      titleLabel: "Archiwum",
      description: "Zarchiwizowane quizy",
      icon: <ArchiveIcon className="size-6" />,
      library: () => {
        return filteredArchivedQuizzes.map((quiz) => ({
          id: quiz.id,
          type: "quiz" as const,
        })) as LibraryItem[];
      },
      isFilterActive:
        searchValue.trim().length > 0 && filteredArchivedQuizzes.length === 0,
      showSort: true,
      emptyState: (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderXIcon />
            </EmptyMedia>
            <EmptyTitle>Archiwum jest puste</EmptyTitle>
            <EmptyDescription>
              Nie znaleziono żadnych usuniętych quizów
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ),
    },
    {
      key: "trash",
      titleLabel: "Ostatnio usunięte",
      description:
        "Usunięte quizy będą przechowywane przez 30 dni, a po tym czasie zostaną trwale skasowane.",
      icon: <MessageCircleXIcon className="size-6" />,
      library: () => {
        return [];
      },
      isFilterActive:
        searchValue.trim().length > 0 && filteredArchivedQuizzes.length === 0,
      showSort: true,
      emptyState: (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderXIcon />
            </EmptyMedia>
            <EmptyTitle>Kosz jest pusty</EmptyTitle>
            <EmptyDescription>
              Nie znaleziono żadnych usuniętych quizów
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ),
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div className="space-y-2 pb-8 text-center">
            <p>Ładowanie quizów...</p>
            <Loader size={15} />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error != null) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>{error.message}</AlertTitle>
      </Alert>
    );
  }

  return (
    <Tabs variant="quiz" defaultValue="all">
      <TabsList>
        {tabsConfig.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            onClick={() => {
              router.push("?");
            }}
          >
            {tab.icon}
            {tab.titleLabel}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabsConfig.map((tab) => {
        return (
          <TabsContent key={tab.key} value={tab.key} className="flex-1">
            <div className="mb-4 flex flex-row gap-4">
              <div className="flex flex-col justify-center">
                <h3 className="text-2xl font-semibold">{tab.titleLabel}</h3>
                {tab.description === undefined ? null : (
                  <p className="text-muted-foreground text-sm">
                    {tab.description}
                  </p>
                )}
              </div>

              {tab.showCreateButton === true ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline">
                        <LayersPlus className="size-5" />
                        Stwórz
                      </Button>
                    }
                  ></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      render={
                        <Link href="/create-quiz">
                          <NotepadTextIcon />
                          Quiz
                        </Link>
                      }
                    ></DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(_event) => {
                        _event.preventDefault();
                        setCurrentDialog({
                          type: "create-folder",
                          quiz: null,
                          folderId: null,
                        });
                      }}
                    >
                      <FolderIcon />
                      Folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {tab.showImportButton === true ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={(props) => (
                    <Link {...props} href="/import-quiz">
                      <ImportIcon className="size-5" />
                      Importuj
                    </Link>
                  )}
                ></Button>
              ) : null}

              {tab.showSort === true ? (
                <QuizSort
                  sortKey={sortKey}
                  onSortKeyChange={setSortKey}
                  searchValue={searchValue}
                  onSearchValueChange={setSearchValue}
                  onResetFilters={handleResetFilters}
                />
              ) : null}
            </div>

            <QuizzesLibrary
              library={
                foldersHistory.length === 0
                  ? tab.library()
                  : (currentFolderContent?.items ?? [])
              }
              userQuizzes={userQuizzes}
              userFolders={userFolders}
              foldersHistory={foldersHistory}
              sortKey={sortKey}
              isFilterActive={tab.isFilterActive}
              canSearchInQuizzes={canSearchInQuizzes}
              handleShareQuiz={handleShareQuiz}
              handleDeleteQuiz={handleDeleteQuiz}
              handleDownloadQuiz={handleDownloadQuiz}
              handleArchiveQuiz={handleArchiveQuiz}
              handleResetFilters={handleResetFilters}
              libraryKey={tab.key}
              onFolderDelete={handleDeleteFolder}
              onFolderRename={handleRenameFolder}
              emptyState={tab.emptyState}
              renderFolders={tab.key === "all" || tab.key === "library"}
              isQuizDraggable={true}
              isFolderDraggable={true}
              handleQuizMoveToFolder={handleQuizMoveToFolder}
              handleFolderMoveToFolder={handleFolderMoveToFolder}
              handleNavigateToFolder={handleNavigateToFolder}
              rootFolderId={rootFolderId ?? ""}
              handleNavigateToRoot={handleNavigateToRoot}
              handleNavigateToHistoryIndex={handleNavigateToHistoryIndex}
              tabLabel={tab.titleLabel}
            />
          </TabsContent>
        );
      })}

      <div className="p-5" />
      {currentDialog.type === "share" && currentDialog.quiz !== null && (
        <ShareQuizDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setCurrentDialog({ type: null, quiz: null, folderId: null });
            }
          }}
          quiz={currentDialog.quiz}
          setQuiz={updateQuiz}
        />
      )}
      <AlertDialog
        open={currentDialog.type === "delete-quiz"}
        onOpenChange={(open) => {
          setCurrentDialog({
            type: open ? "delete-quiz" : null,
            quiz: open ? currentDialog.quiz : null,
            folderId: null,
          });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten quiz? Tej operacji nie można
              cofnąć! Ty oraz inni użytkownicy nie będą mogli już korzystać z
              tego quizu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteQuiz}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={currentDialog.type === "delete-folder"}
        onOpenChange={(open) => {
          setCurrentDialog({
            type: open ? "delete-folder" : null,
            quiz: null,
            folderId: open ? currentDialog.folderId : null,
          });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Potwierdź usunięcie</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć ten folder? Tej operacji nie można
              cofnąć! Ty oraz inni użytkownicy nie będą mogli już korzystać z
              tego quizu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFolder}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={currentDialog.type === "rename-folder"}
        onOpenChange={(open) => {
          setCurrentDialog({
            type: open ? "rename-folder" : null,
            quiz: null,
            folderId: open ? currentDialog.folderId : null,
          });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj nazwę folderu</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Button
              className="flex items-center justify-center"
              onClick={confirmFolderRename}
              disabled={
                isRenamingFolder || renameFolderInput.trim().length === 0
              }
            >
              {isRenamingFolder ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : (
                <span>Zapisz</span>
              )}
            </Button>
            <Input
              type="text"
              value={renameFolderInput}
              onChange={(_event) => {
                const value = _event.target.value;
                setRenameFolderInput(value);
              }}
              aria-invalid={renameFolderInput.trim().length <= 0}
              className="flex flex-1"
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={currentDialog.type === "create-folder"}
        onOpenChange={(open) => {
          setCurrentDialog({
            type: open ? "create-folder" : null,
            quiz: null,
            folderId: null,
          });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stwórz nowy folder</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="flex items-center justify-center"
                    onClick={handleCreateNewFolder}
                    disabled={
                      isCreatingNewFolder || newFolderInput.trim().length === 0
                    }
                  >
                    {isCreatingNewFolder ? (
                      <LoaderCircleIcon className="animate-spin" />
                    ) : (
                      <span>Utwórz</span>
                    )}
                  </Button>
                }
              ></TooltipTrigger>
              <TooltipContent>Stwórz nowy folder</TooltipContent>
            </Tooltip>
            <Input
              type="text"
              value={newFolderInput}
              onChange={(_event) => {
                const value = _event.target.value;
                setNewFolderInput(value);
              }}
              aria-invalid={newFolderInput.trim().length <= 0}
              placeholder="Nowy folder"
              className="flex flex-1"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

export function QuizzesPageClient({ userId }: QuizzesPageContentProps) {
  return <QuizzesPageContent userId={userId} />;
}
