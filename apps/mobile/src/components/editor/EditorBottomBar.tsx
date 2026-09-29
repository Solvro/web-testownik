export interface EditorBottomBarProps {
  position: string;
  positionLabel: string;
  canPrevious: boolean;
  canNext: boolean;
  disabled: boolean;
  saveDisabled: boolean;
  saveLabel: string;
  previous: () => void;
  next: () => void;
  add: () => void;
  openList: () => void;
  save: () => void;
}

// Only Android renders the Material bottom app bar (EditorBottomBar.android.tsx).
export default function EditorBottomBar(_props: EditorBottomBarProps) {
  return null;
}
