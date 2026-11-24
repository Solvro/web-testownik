export const AUTH_COOKIES = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

// Keeps the address out of URLs, where analytics and server logs would see it.
export const OTP_EMAIL_STORAGE_KEY = "login-otp-email";
