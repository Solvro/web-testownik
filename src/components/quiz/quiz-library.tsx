import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { FolderXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ViewTransition, useEffect } from "react";

import { QuizEmptyLibrary } from "@/components/quiz/dashboard/quiz-empty-library";
import { QuizFilterNotFound } from "@/components/quiz/dashboard/quiz-filter-not-found";
import { FolderCard } from "@/components/quiz/folder-card";
import type { LibrarySortKey } from "@/components/quiz/library-sort";
import { QuizCard } from "@/components/quiz/quiz-card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Folder, LibraryItem, QuizMetadata } from "@/types/quiz";

export interface QuizzesLibraryProps {
  // libraryQuizzes: QuizMetadata[] | SharedQuiz[];
  // libraryFolders: Folder[];
  library: LibraryItem[];
  userQuizzes: QuizMetadata[];
  userFolders: Folder[];
  foldersHistory: Folder[];
  sortKey: LibrarySortKey;
  isFilterActive?: boolean;
  // Quizzes
  handleShareQuiz: (quiz: QuizMetadata) => void;
  handleDeleteQuiz: (quiz: QuizMetadata) => void;
  handleDownloadQuiz: (quiz: QuizMetadata) => void;
  handleArchiveQuiz: (quiz: QuizMetadata) => void;
  handleLibraryLoad: (folderId: string) => void;
  canSearchInQuizzes: boolean;
  // Folders
  onFolderDelete: (folderId: string) => void;
  onFolderRename: (folderId: string) => void;
  renderFolders?: boolean;

  handleResetFilters: () => void;
  libraryKey: string;
  emptyState?: ReactNode;
  isQuizDraggable?: boolean;
  isFolderDraggable?: boolean;
  handleMoveQuizToFolder: (quizId: string, folderId: string) => void;
}

export function QuizzesLibrary({
  // libraryQuizzes,
  // libraryFolders,
  library,
  userQuizzes,
  userFolders,
  foldersHistory,
  sortKey,
  isFilterActive,
  canSearchInQuizzes,
  handleShareQuiz,
  handleDeleteQuiz,
  handleDownloadQuiz,
  handleArchiveQuiz,
  handleLibraryLoad,
  handleResetFilters,
  libraryKey,
  onFolderDelete,
  onFolderRename,
  emptyState,
  renderFolders,
  isQuizDraggable,
  isFolderDraggable,
  handleMoveQuizToFolder,
}: QuizzesLibraryProps): ReactNode {
  const hasItems = library.length > 0;
  const inferredFilterActive =
    (libraryKey === "all" || libraryKey === "library") &&
    userQuizzes.length > 0 &&
    !hasItems;
  const finalIsFilterActive = isFilterActive ?? inferredFilterActive;

  const folders = library.filter((library_) => library_.type === "folder");
  const quizzes = library.filter((library_) => library_.type === "quiz");

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];

        const quizId = source.data.quizId as string;
        const folderId = destination.data.folderId as string;

        if (quizId && folderId) {
          handleMoveQuizToFolder(quizId, folderId);
        }
      },
    });
  }, [handleMoveQuizToFolder]);

  if (hasItems) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ViewTransition>
          {/* Render folders */}
          {renderFolders === true
            ? folders.map((item) => {
                const folder = userFolders.find(
                  (folder_) => folder_.id === item.id,
                );
                if (folder === undefined) {
                  return null;
                }
                return (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    userQuizzes={userQuizzes}
                    sortKey={sortKey}
                    libraryKey={libraryKey}
                    showEdit={true}
                    showDelete={true}
                    onDelete={onFolderDelete}
                    onRename={onFolderRename}
                    onOpen={handleLibraryLoad}
                    isDraggable={isFolderDraggable}
                  />
                );
              })
            : null}
          {/* Render quizzes */}
          {quizzes.map((item) => {
            const quiz = userQuizzes.find((quiz_) => quiz_.id === item.id);
            if (quiz == null) {
              return null;
            }

            return (
              <QuizCard
                key={item.id}
                quiz={quiz}
                showEdit={quiz.can_edit}
                showShare={quiz.folder.folder_type !== "archive"}
                showDelete={true}
                showDownload={true}
                showArchive={quiz.folder.folder_type !== "archive"}
                showSearch={canSearchInQuizzes}
                onShare={handleShareQuiz}
                onDelete={handleDeleteQuiz}
                onArchive={handleArchiveQuiz}
                onDownload={handleDownloadQuiz}
                libraryKey={libraryKey}
                isDraggable={isQuizDraggable}
              />
            );
          })}
        </ViewTransition>
      </div>
    );
  } else if (finalIsFilterActive) {
    return <QuizFilterNotFound handleResetFilters={handleResetFilters} />;
  } else {
    // We are in empty folder
    return foldersHistory.length > 0 ? (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderXIcon />
          </EmptyMedia>
          <EmptyTitle>Ten folder jest pusty</EmptyTitle>
          <EmptyDescription>Nie znaleziono żadnych quizów</EmptyDescription>
        </EmptyHeader>
      </Empty>
    ) : (
      (emptyState ?? <QuizEmptyLibrary />)
    );
  }
}
