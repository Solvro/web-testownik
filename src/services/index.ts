import { API_URL } from "@/lib/api";
import { FolderService } from "@/services/folder.service";

import { ImageService } from "./image.service";
import { QuizService } from "./quiz.service";
import { UserService } from "./user.service";

/**
 * Service registry for managing all API services
 */
export class ServiceRegistry {
  private quizService: QuizService;
  private folderService: FolderService;
  private userService: UserService;
  private imageService: ImageService;

  constructor(
    baseURL: string,
    defaultHeaders: Record<string, string> = {},
    accessToken?: string,
  ) {
    this.quizService = new QuizService(baseURL, defaultHeaders, accessToken);
    this.folderService = new FolderService(
      baseURL,
      defaultHeaders,
      accessToken,
    );
    this.userService = new UserService(baseURL, defaultHeaders, accessToken);
    this.imageService = new ImageService(baseURL, defaultHeaders, accessToken);
  }

  /**
   * Get the quiz service
   */
  get quiz(): QuizService {
    return this.quizService;
  }

  /**
   * Get the folder service
   */
  get folder(): FolderService {
    return this.folderService;
  }

  /**
   * Get the user service
   */
  get user(): UserService {
    return this.userService;
  }

  /**
   * Get the image service
   */
  get image(): ImageService {
    return this.imageService;
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
 * Get the service registry instance.
 * Lazily initializes with the default API URL on first access; callers can
 * override earlier by calling initializeServices() explicitly.
 */
export function getServices(): ServiceRegistry {
  serviceRegistry ??= new ServiceRegistry(API_URL);
  return serviceRegistry;
}

/**
 * Get quiz service directly
 */
export function getQuizService(): QuizService {
  return getServices().quiz;
}

/**
 * Get folder service directly
 */
export function getFolderService(): FolderService {
  return getServices().folder;
}

/**
 * Get user service directly
 */
export function getUserService(): UserService {
  return getServices().user;
}

/**
 * Get image service directly
 */
export function getImageService(): ImageService {
  return getServices().image;
}
