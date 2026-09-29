export interface ModelOption {
  value: string;
  label: string;
  provider?: string;
}

export interface ModelListProps {
  models: ModelOption[];
  /** null picks the account default. */
  selected: string | null;
  /** The model "Default" uses right now. */
  defaultModel?: { label: string; provider?: string };
  select: (model: string | null) => void;
}
