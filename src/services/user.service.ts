import { GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { getCookie } from "@/lib/cookies";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

import { BaseApiService } from "./base-api.service";
import type { AlertData, GradesData, UserData, UserSettings } from "./types";
import { STORAGE_KEYS } from "./types";

/**
 * Service for handling user-related API operations
 */
export class UserService extends BaseApiService {
  /**
   * Fetch current user data
   */
  async getUserData(): Promise<UserData> {
    const response = await this.get<UserData>("/user/");
    return response.data;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userData: Partial<UserData>): Promise<UserData> {
    if (this.isGuestMode()) {
      throw new Error("Cannot update profile in guest mode");
    }
    const response = await this.patch<UserData>("/user/", userData);
    return response.data;
  }

  /**
   * Get user settings
   */
  async getUserSettings(): Promise<UserSettings> {
    if (this.isGuestMode()) {
      const storedSettings = this.getStoredSettings();
      if (storedSettings != null) {
        return storedSettings;
      }
      return { ...DEFAULT_USER_SETTINGS };
    }
    const response = await this.get<UserSettings>("/settings/");
    const settings = response.data;
    this.storeSettings(settings);
    return settings;
  }

  /**
   * Update user settings
   */
  async updateUserSettings(
    settings: Partial<UserSettings>,
  ): Promise<UserSettings> {
    if (this.isGuestMode()) {
      const storedSettings = this.getStoredSettings();
      this.storeSettings({
        ...DEFAULT_USER_SETTINGS,
        ...storedSettings,
        ...settings,
      });
      return { ...DEFAULT_USER_SETTINGS, ...storedSettings, ...settings };
    }
    const response = await this.patch<UserSettings>("/settings/", settings);
    const updatedSettings = response.data;
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify(updatedSettings),
    );
    return updatedSettings;
  }

  /**
   * Get user grades
   */
  async getGrades(): Promise<GradesData> {
    const response = await this.get<GradesData>("/grades/");
    return response.data;
  }

  /**
   * Generate OTP for login
   */
  async generateOTP(email: string): Promise<{ message: string }> {
    const response = await this.post<{ message: string }>("/generate-otp/", {
      email,
    });
    return response.data;
  }

  /**
   * Verify OTP for login
   */
  async verifyOTP(
    email: string,
    otp: string,
  ): Promise<{ access: string; refresh: string }> {
    const response = await this.post<{ access: string; refresh: string }>(
      "/login-otp/",
      {
        email,
        otp,
      },
    );
    return response.data;
  }

  /**
   * Login with link token
   */
  async loginWithLink(
    token: string,
  ): Promise<{ access: string; refresh: string }> {
    const response = await this.post<{ access: string; refresh: string }>(
      "/login-link/",
      {
        token,
      },
    );
    return response.data;
  }

  /**
   * Get alerts
   */
  async getAlerts(): Promise<AlertData[]> {
    const response = await this.get<AlertData[]>("/alerts/");
    return response.data;
  }

  /**
   * Send feedback/bug report
   */
  async sendFeedback(feedbackData: Record<string, unknown>): Promise<object> {
    const response = await this.post<object>("/feedback/send", feedbackData);
    return response.data;
  }

  /**
   * Store user data in localStorage
   */
  storeUserData(userData: UserData): void {
    try {
      localStorage.setItem("profile_picture", userData.photo);
      localStorage.setItem("is_staff", userData.is_staff.toString());
      localStorage.setItem("user_id", userData.id);
    } catch (error) {
      console.error("Error storing user data:", error);
    }
  }

  /**
   * Get stored settings
   */
  getStoredSettings(): UserSettings | null {
    try {
      const stored = localStorage.getItem("settings");
      if (stored !== null && stored.trim() !== "") {
        return JSON.parse(stored) as UserSettings;
      }
      return null;
    } catch (error) {
      console.error("Error parsing stored settings:", error);
      return null;
    }
  }

  /**
   * Store settings in localStorage
   */
  storeSettings(settings: UserSettings): void {
    try {
      localStorage.setItem("settings", JSON.stringify(settings));
    } catch (error) {
      console.error("Error storing settings:", error);
    }
  }

  /**
   * Check if user is in guest mode
   */
  isGuestMode(): boolean {
    // Check cookie first, then localStorage for legacy support
    const fromCookie = getCookie(GUEST_COOKIE_NAME) === "true";
    const fromStorage = localStorage.getItem(STORAGE_KEYS.IS_GUEST) === "true";
    return fromCookie || fromStorage;
  }
}
