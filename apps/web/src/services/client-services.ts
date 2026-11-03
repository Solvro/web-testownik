import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { ClipboardService } from "./clipboard.service";
import { getQuizService, getUserService } from "./index";
import type { QuizService } from "./quiz.service";
import type { UserService } from "./user.service";

/**
 * The services a query cache talks to. The app's cache uses the app-wide
 * registry; the landing page's device previews bind a throwaway cache to local
 * fixtures, so nothing they do reaches the API, the session or the clipboard.
 *
 * Query and mutation functions get the cache as `context.client`; components
 * that call a service directly use `useServices()`.
 */
export interface AppServices {
  quiz: QuizService;
  user: UserService;
  clipboard: ClipboardService;
}

const boundServices = new WeakMap<QueryClient, AppServices>();

const appClipboard = new ClipboardService();

function getAppServices(): AppServices {
  // Resolved per call: `initializeServices` may replace the registry.
  return {
    quiz: getQuizService(),
    user: getUserService(),
    clipboard: appClipboard,
  };
}

/** Routes every request made through `client` to `services`. */
export function bindServices(client: QueryClient, services: AppServices): void {
  boundServices.set(client, services);
}

export function servicesFor(client: QueryClient): AppServices {
  return boundServices.get(client) ?? getAppServices();
}

export function useServices(): AppServices {
  return servicesFor(useQueryClient());
}
