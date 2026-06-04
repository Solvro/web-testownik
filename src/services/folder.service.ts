import type { Folder, Library } from "@/types/quiz";

import { BaseApiService } from "./base-api.service";

/**
 * Service for handling folder-related API operations
 */
export class FolderService extends BaseApiService {
  /**
   * Get user library
   */
  async getLibrary(): Promise<Library> {
    const response = await this.get<Library>("library/");
    return response.data;
  }

  /**
   * Fetch a specific library by ID
   */
  async getLibraryById(folderId: string): Promise<Library> {
    const response = await this.get<Library>(`library/${folderId}/`);
    return response.data;
  }

  /**
   * Get user folder
   */
  async getFolders(): Promise<Folder[]> {
    const response = await this.get<Folder[]>("folders/");
    return response.data;
  }

  /**
   * Create a new folder
   */
  async createFolder(folderData: {
    name: string;
    parent: string;
  }): Promise<Folder> {
    const response = await this.post<Folder>("folders/", folderData);
    return response.data;
  }

  /**
   * Update an existing folder
   */
  async updateFolder(
    folderId: string,
    folderData: Partial<Folder>,
  ): Promise<Folder> {
    const response = await this.patch<Folder>(
      `folders/${folderId}/`,
      folderData,
    );
    return response.data;
  }

  /**
   * Move folder
   */
  async moveFolder(folderId: string, parentId: string): Promise<Folder> {
    const response = await this.post<Folder>(`folders/${folderId}/move/`, {
      parent_id: parentId,
    });
    return response.data;
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId: string): Promise<void> {
    await this.delete(`folders/${folderId}/`);
  }
}
