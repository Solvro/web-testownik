// iOS only: other platforms keep the single-page editor in app/editor.tsx.
export default function EditorOverview(_props: {
  title: string;
  description: string;
  questions: unknown[];
  error: string;
  openDetails: () => void;
  openQuestion: (id: string) => void;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
  add: () => void;
}) {
  return null;
}
