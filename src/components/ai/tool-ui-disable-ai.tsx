"use client";
/* eslint-disable react-refresh/only-export-components */
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { BanIcon, CheckIcon, LoaderCircleIcon, PowerIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { quizDetailQueryKey } from "@/components/quiz/helpers/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserService } from "@/services";

import { useAiChatContext } from "./ai-chat-context";

function DisableAiCard({ reason }: { reason: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const { quizId } = useAiChatContext();
  const queryClient = useQueryClient();

  const handleDisable = async () => {
    setState("loading");
    try {
      await getUserService().updateUserSettings({ ai_disabled: true });
      setState("done");
      toast.success(
        "Funkcje AI zostały wyłączone, możesz je ponownie włączyć w profilu.",
      );
      void queryClient.refetchQueries({ queryKey: quizDetailQueryKey(quizId) });
    } catch {
      setState("idle");
      toast.error("Nie udało się wyłączyć funkcji AI.");
    }
  };

  if (state === "done") {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <CheckIcon className="text-primary size-5 shrink-0" />
          <p className="text-sm">
            Funkcje AI zostały wyłączone. Możesz je ponownie włączyć w
            ustawieniach profilu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PowerIcon className="text-destructive size-4" />
          <CardTitle className="text-sm">Wyłączenie funkcji AI</CardTitle>
        </div>
        <CardDescription className="text-xs">{reason}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          Spowoduje to ukrycie czatu AI, przycisku wyjaśniania i wszystkich
          innych funkcji AI. Możesz je ponownie włączyć w ustawieniach profilu.
        </p>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleDisable}
          disabled={state === "loading"}
        >
          {state === "loading" ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : (
            <BanIcon />
          )}
          Wyłącz AI
        </Button>
      </CardContent>
    </Card>
  );
}

//eslint-disable-next-line @typescript-eslint/no-deprecated
export const DisableAiToolUI = makeAssistantToolUI<{ reason: string }, string>({
  toolName: "disable_ai",
  render: ({ args }) => {
    return <DisableAiCard reason={args.reason} />;
  },
});
