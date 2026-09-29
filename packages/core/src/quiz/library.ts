export interface LibraryItem {
  id: string;
  name: string;
  type: "quiz" | "folder";
  can_edit: boolean;
  can_manage?: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  folder_type?: string;
  description?: string;
  question_count?: number | null;
  created_at?: string;
  last_used_at?: string | null;
  /** Set when the item is a shortcut to someone else's quiz. */
  shortcut_id?: string | null;
}
export interface LibraryData {
  path: { id: string; name: string }[];
  items: LibraryItem[];
  can_create_folder: boolean;
}
export type LibrarySort = "recent" | "newest" | "oldest" | "az" | "za";
const time = (value?: string | null) => {
  if (value == null) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
export function sortLibrary(
  items: LibraryItem[],
  sort: LibrarySort,
  language: string,
) {
  return [...items].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    const names = a.name.localeCompare(b.name, language, {
      numeric: true,
      sensitivity: "base",
    });
    if (sort === "az" || sort === "za") {
      return (sort === "az" ? names : -names) || a.id.localeCompare(b.id);
    }
    const delta =
      sort === "recent"
        ? time(b.last_used_at) - time(a.last_used_at)
        : sort === "newest"
          ? time(b.created_at) - time(a.created_at)
          : time(a.created_at) - time(b.created_at);
    return delta || names || a.id.localeCompare(b.id);
  });
}
export function canMoveTo(
  data: LibraryData,
  source: { id: string; type: string; parent?: string },
) {
  const target = data.path.at(-1)?.id;
  return (
    target !== undefined &&
    target !== "" &&
    data.can_create_folder &&
    target !== source.parent &&
    (source.type !== "folder" ||
      !data.path.some((folder) => folder.id === source.id))
  );
}
