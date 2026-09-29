export interface QuizListItem {
  id: string;
  title: string;
  detail: string;
  progress: { mastered: number; total: number } | null;
  canEdit: boolean;
}

export interface QuizListActions {
  open: (id: string) => void;
  edit: (id: string) => void;
  share: (id: string) => void;
}
