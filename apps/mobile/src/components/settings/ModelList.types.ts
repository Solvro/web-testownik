export interface ModelOption {
  value: string;
  label: string;
  provider?: string;
}

export interface ModelListProps {
  models: ModelOption[];
  /** null follows Study Settings for a quiz, or Testownik's default for an account. */
  selected: string | null;
  /** The model the default row uses right now. */
  defaultModel?: { label: string; provider?: string };
  scope?: "account" | "quiz";
  select: (model: string | null) => void;
  disabled?: boolean;
}
