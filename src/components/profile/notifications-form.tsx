import { AlertCircleIcon } from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context.ts";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch";
import type { SettingsFormProps } from "@/types/user.ts";

export function NotificationsForm({
  settings,
  onSettingChange,
}: SettingsFormProps) {
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
          <CardTitle>Powiadomienia</CardTitle>
          <p className="text-muted-foreground text-xs">
            Wybierz, które powiadomienia chcesz otrzymywać
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div>
              <Label
                className={`text-sm font-medium ${appContext.isGuest ? "text-muted-foreground" : ""}`}
                htmlFor="quiz_share"
              >
                Udostępnienie quizu
              </Label>
              <p className="text-muted-foreground text-xs">
                Ktoś udostępnił Ci quiz
              </p>
            </div>
            <Switch
              id="quiz_share"
              checked={settings.notify_quiz_shared}
              onCheckedChange={(checked) => {
                onSettingChange("notify_quiz_shared", checked);
              }}
              disabled={appContext.isGuest}
              className="ml-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label
                className={`text-sm font-medium ${appContext.isGuest ? "text-muted-foreground" : ""}`}
                htmlFor="issue_report"
              >
                Zgłoszenie problemu
              </Label>
              <p className="text-muted-foreground text-xs">
                Ktoś zgłosił problem z Twoim quizem
              </p>
            </div>
            <Switch
              id="issue_report"
              checked={settings.notify_bug_reported}
              onCheckedChange={(checked) => {
                onSettingChange("notify_bug_reported", checked);
              }}
              disabled={appContext.isGuest}
              className="ml-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label
                className={`text-sm font-medium ${appContext.isGuest ? "text-muted-foreground" : ""}`}
                htmlFor="marketing"
              >
                Marketingowe
              </Label>
              <p className="text-muted-foreground text-xs">
                Otrzymuj powiadomienia o nowych funkcjonalnościach i ofertach
                specjalnych
              </p>
            </div>
            <Switch
              id="marketing"
              checked={settings.notify_marketing}
              onCheckedChange={(checked) => {
                onSettingChange("notify_marketing", checked);
              }}
              disabled={appContext.isGuest}
              className="ml-auto"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
