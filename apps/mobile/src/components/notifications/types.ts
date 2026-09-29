export interface InboxItem {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at?: string;
  /** Where tapping leads; empty when the notification is informational. */
  link?: string;
}

export interface InboxProps {
  items: InboxItem[];
  loading: boolean;
  error: unknown;
  busy: boolean;
  refresh: () => Promise<unknown>;
  retry: () => void;
  mark: (read: boolean, id?: string) => void;
  date: (value?: string) => string | null;
  openLink: (href: string) => void;
  /** Marks the notification read and follows its link, if it has one. */
  open: (item: InboxItem) => void;
}
