import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ViewTransition } from "react";

import { QuizEmptyLibrary } from "@/components/quiz/dashboard/quiz-empty-library";
import { QuizFilterNotFound } from "@/components/quiz/dashboard/quiz-filter-not-found";
import { FolderCard } from "@/components/quiz/folder-card";
import type { LibrarySortKey } from "@/components/quiz/library-sort";
import { QuizCard } from "@/components/quiz/quiz-card";
import type { Folder, QuizMetadata, SharedQuiz } from "@/types/quiz";

export interface QuizzesLibraryProps {
  libraryQuizzes: QuizMetadata[] | SharedQuiz[];
  libraryFolders: Folder[];
  userQuizzes: QuizMetadata[];
  sortKey: LibrarySortKey;
  isFilterActive?: boolean;
  canSearchInQuizzes: boolean;
  handleShareQuiz: (quiz: QuizMetadata) => void;
  handleDeleteQuiz: (quiz: QuizMetadata) => void;
  handleDownloadQuiz: (quiz: QuizMetadata) => void;
  handleResetFilters: () => void;
  libraryKey: string;
  onFolderDelete: (folderId: string) => void;
  onFolderRename: (folderId: string) => void;
  emptyState?: ReactNode;
  renderFolders?: boolean;
  isQuizDraggable?: boolean;
  isFolderDraggable?: boolean;
  handleMoveQuizToFolder: (quizId: string, folderId: string) => void;
}

export function QuizzesLibrary({
  libraryQuizzes,
  libraryFolders,
  userQuizzes,
  sortKey,
  isFilterActive,
  canSearchInQuizzes,
  handleShareQuiz,
  handleDeleteQuiz,
  handleDownloadQuiz,
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
  const hasItems =
    renderFolders === true
      ? libraryFolders.length > 0 || libraryQuizzes.length > 0
      : libraryQuizzes.length > 0;
  const inferredFilterActive =
    (libraryKey === "all" || libraryKey === "library") &&
    userQuizzes.length > 0 &&
    !hasItems;
  const finalIsFilterActive = isFilterActive ?? inferredFilterActive;

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const destination = location.current.dropTargets[0];
        if (!destination) {
          return;
        }

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
          {renderFolders === true
            ? libraryFolders.map((item) => (
                <FolderCard
                  key={item.id}
                  folder={item}
                  userQuizzes={userQuizzes}
                  sortKey={sortKey}
                  libraryKey={libraryKey}
                  showEdit={true}
                  showDelete={true}
                  onDelete={onFolderDelete}
                  onRename={onFolderRename}
                  isDraggable={isFolderDraggable}
                />
              ))
            : null}
          {libraryQuizzes.map((item) => {
            const isShared = "quiz" in item;
            const quizData = isShared ? item.quiz : item;

            return (
              <QuizCard
                key={isShared ? item.id : quizData.id}
                quiz={quizData}
                showEdit={isShared ? Boolean(item.quiz.can_edit) : true}
                showShare={!isShared}
                showDelete={!isShared}
                showDownload
                showSearch={canSearchInQuizzes}
                onShare={handleShareQuiz}
                onDelete={handleDeleteQuiz}
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
    return emptyState ?? <QuizEmptyLibrary />;
  }
}
