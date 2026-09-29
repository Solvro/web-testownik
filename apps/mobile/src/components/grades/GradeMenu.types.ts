export interface GradeMenuProps {
  label: string;
  /** The grade shown now: a prediction, or the USOS grade. */
  value: number | null;
  display: string;
  options: { value: number; label: string }[];
  predicted: boolean;
  onChange: (value: number) => void;
  onRestore: () => void;
}
