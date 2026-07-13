/** Number formats used by the count-up animation and static labels. */
export type WrappedFormat = "int" | "pct" | "time";

/** Format a value for display. `time` interprets the value as **minutes**. */
export function formatValue(value: number, format: WrappedFormat): string {
  if (format === "time") {
    const minutes = Math.round(value);
    const hours = Math.floor(minutes / 60);
    return `${String(hours)} godz ${String(minutes % 60)} min`;
  }
  if (format === "pct") {
    return `${String(Math.round(value))}%`;
  }
  // pl-PL groups with a narrow/no-break space; normalise to a plain space.
  return Math.round(value).toLocaleString("pl-PL").replaceAll(/\s/g, " ");
}
