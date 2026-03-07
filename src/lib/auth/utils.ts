import { env } from "@/env";
import { API_URL } from "@/lib/api";

export async function createGuestAccount(): Promise<Response | null> {
  try {
    const backendResponse = await fetch(`${API_URL}/guest/create/`, {
      method: "POST",
      headers: {
        "Api-Key": env.INTERNAL_API_KEY ?? "",
        "Content-Type": "application/json",
      },
    });

    if (!backendResponse.ok) {
      return null;
    }

    return backendResponse;
  } catch {
    return null;
  }
}
