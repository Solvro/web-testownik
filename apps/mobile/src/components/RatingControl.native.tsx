import Choice from "./native/Choice";
import { useLocale } from "../lib/locale";
import type { RatingControlProps } from "./RatingControl";

// Retain the existing native Material buttons on Android during the iOS pass.
export default function RatingControl({
  value,
  onChange,
  disabled = false,
}: RatingControlProps) {
  const { t } = useLocale();
  return (
    <Choice
      disabled={disabled}
      label={t("Ocena quizu", "Quiz rating")}
      value={String(value)}
      options={[1, 2, 3, 4, 5].map((n) => ({
        value: String(n),
        label: t(`Ocena ${n} z 5`, `Rate ${n} out of 5`),
      }))}
      onChange={(next) => onChange(Number(next))}
    />
  );
}
