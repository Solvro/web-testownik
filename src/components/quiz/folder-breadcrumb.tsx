import { useDroppable } from "@dnd-kit/react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import type { Folder } from "@/types/quiz";

interface DroppableBreadcrumbItemProps {
  folder: Folder;
  index: number;
  isLast: boolean;
  handleNavigateToHistoryIndex: (index: number) => void;
}

export interface FolderBreadcrumbProps {
  label: string;
  foldersHistory: Folder[];
  handleNavigateToRoot: () => void;
  handleNavigateToHistoryIndex: (index: number) => void;
  rootFolderId: string;
}

function DroppableBreadcrumbItem({
  folder,
  index,
  isLast,
  handleNavigateToHistoryIndex,
}: DroppableBreadcrumbItemProps) {
  const { ref: breadcrumbRef, isDropTarget } = useDroppable({
    id: folder.id,
    data: {
      folderId: folder.id,
      type: "breadcrumb",
    },
  });

  return (
    <BreadcrumbItem>
      <BreadcrumbLink
        onClick={() => {
          handleNavigateToHistoryIndex(index);
        }}
        aria-disabled={isLast}
        ref={breadcrumbRef}
        className={cn(isDropTarget && "font-bold text-indigo-500")}
      >
        {folder.name}
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

export function FolderBreadcrumb({
  label,
  foldersHistory,
  handleNavigateToRoot,
  handleNavigateToHistoryIndex,
  rootFolderId,
}: FolderBreadcrumbProps) {
  const { ref: rootDropRef, isDropTarget } = useDroppable({
    id: rootFolderId,
    data: {
      folderId: rootFolderId,
      type: "breadcrumb",
    },
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            onClick={() => {
              handleNavigateToRoot();
            }}
            aria-disabled={foldersHistory.length === 0}
            ref={rootDropRef}
            className={cn(isDropTarget && "font-bold text-indigo-500")}
          >
            {label}
          </BreadcrumbLink>
        </BreadcrumbItem>

        {foldersHistory.length > 0 && <BreadcrumbSeparator />}

        {foldersHistory.map((folder, index) => {
          return (
            <div key={folder.id} className="flex items-center gap-2">
              <DroppableBreadcrumbItem
                folder={folder}
                index={index}
                isLast={index === foldersHistory.length - 1}
                handleNavigateToHistoryIndex={handleNavigateToHistoryIndex}
              />
              {index < foldersHistory.length - 1 && <BreadcrumbSeparator />}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
