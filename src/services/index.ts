import { QuizService } from "./quiz.service";
import { UserService } from "./user.service";

/**
 * Service registry for managing all API services
 */
export class ServiceRegistry {
  private quizService: QuizService;
  private userService: UserService;

  constructor(
    baseURL: string,
    defaultHeaders: Record<string, string> = {},
    accessToken?: string,
  ) {
    this.quizService = new QuizService(baseURL, defaultHeaders, accessToken);
    this.userService = new UserService(baseURL, defaultHeaders, accessToken);
  }

  /**
   * Get the quiz service
   */
  get quiz(): QuizService {
    return this.quizService;
  }

  /**
   * Get the user service
   */
  get user(): UserService {
    return this.userService;
  }
}

// Singleton instance
let serviceRegistry: ServiceRegistry | null = null;

/**
 * Initialize the service registry with base URL
 */
export function initializeServices(
  baseURL: string,
  defaultHeaders: Record<string, string> = {},
  accessToken?: string,
): void {
  serviceRegistry = new ServiceRegistry(baseURL, defaultHeaders, accessToken);
}

/**
 * Get the service registry instance
 * Must be initialized first with initializeServices()
 */
export function getServices(): ServiceRegistry {
  if (serviceRegistry === null) {
    throw new Error(
      "Services not initialized. Call initializeServices() first.",
    );
  }
  return serviceRegistry;
}

/**
 * Get quiz service directly
 */
export function getQuizService(): QuizService {
  return getServices().quiz;
}

/**
 * Get user service directly
 */
export function getUserService(): UserService {
  return getServices().user;
}
