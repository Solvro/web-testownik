import { streamText } from "ai";

import { env } from "@/env";
import { resolveImages } from "@/lib/ai/images";
import { chatModel } from "@/lib/ai/model";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import { getServerCurrentUser } from "@/lib/auth/utils.server";

export const maxDuration = 30;

export async function POST(request: Request) {
  if (env.OPENAI_API_KEY === undefined) {
    return new Response("AI is not configured", { status: 503 });
  }

  const user = await getServerCurrentUser();
  if (user == null) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user.account_type, PermissionAction.AI_FEATURES)) {
    return new Response("AI features require a full account", { status: 403 });
  }

  const { system, prompt, images } = (await request.json()) as {
    system: string;
    prompt: string;
    images?: string[];
  };

  const imageParts =
    images !== undefined && images.length > 0
      ? await resolveImages(images)
      : [];

  const result = streamText({
    model: chatModel,
    system,
    prompt:
      imageParts.length > 0
        ? [
            {
              role: "user" as const,
              content: [...imageParts, { type: "text" as const, text: prompt }],
            },
          ]
        : prompt,
  });

  return result.toTextStreamResponse();
}
