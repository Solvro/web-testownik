import { AlertCircleIcon } from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context.ts";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch";
import type { SettingsFormProps } from "@/types/user.ts";

export function SettingsForm({ settings, onSettingChange }: SettingsFormProps) {
  const appContext = useContext(AppContext);

  return (
    <>
      {appContext.isGuest ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Część ustawień jest niedostępna dla gości.</AlertTitle>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Ustawienia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div>
              <Label
                className={`text-sm font-medium ${appContext.isGuest ? "text-muted-foreground" : ""}`}
                htmlFor="sync-progress"
              >
                Synchronizuj postępy
              </Label>
              <p className="text-muted-foreground text-xs">
                Zapisuj postęp quizów w chmurze
              </p>
            </div>
            <Switch
              id="sync-progress"
              checked={settings.sync_progress}
              onCheckedChange={(checked) => {
                onSettingChange("sync_progress", checked);
              }}
              disabled={appContext.isGuest}
              className="ml-auto"
            />
          </div>
          <div className="grid gap-2">
            <Label
              className="text-sm font-medium"
              htmlFor="initial-reoccurrences"
            >
              Wstępna liczba powtórzeń
            </Label>
            <Input
              id="initial-reoccurrences"
              type="number"
              min={1}
              value={settings.initial_reoccurrences}
              onChange={(event_) => {
                onSettingChange(
                  "initial_reoccurrences",
                  Number(event_.target.value),
                );
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label
              className="text-sm font-medium"
              htmlFor="wrong-answer-reoccurrences"
            >
              Liczba dodatkowych powtórzeń przy błędnej odpowiedzi
            </Label>
            <Input
              id="wrong-answer-reoccurrences"
              type="number"
              min={0}
              value={settings.wrong_answer_reoccurrences}
              onChange={(event_) => {
                onSettingChange(
                  "wrong_answer_reoccurrences",
                  Number(event_.target.value),
                );
              }}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
