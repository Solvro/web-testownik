const apiUrl = process.env.NEXT_PUBLIC_API_URL;

if (typeof apiUrl !== "string") {
  throw new TypeError("NEXT_PUBLIC_API_URL is not defined");
}

export const API_URL = apiUrl;
