export interface ConnectedApp {
  id: string;
  name: string;
  permissions: string[];
  /** The app the user is using right now; disconnecting it would sign them out. */
  current: boolean;
}

export interface AccountContentProps {
  name: string;
  email?: string | null;
  hideProfile: boolean;
  busy: boolean;
  setHideProfile: (hide: boolean) => void;
  privacyError: unknown;
  apps: ConnectedApp[] | undefined;
  appsLoading: boolean;
  appsError: unknown;
  retryApps: () => void;
  disconnect: (app: ConnectedApp) => void;
  /** Why the app in use can’t be disconnected here. */
  explainCurrentApp: () => void;
  openPrivacyPolicy: () => void;
  /** Absent for guests, whose data leaves with the guest session. */
  deleteAccount?: () => void;
}
