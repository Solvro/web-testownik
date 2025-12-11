import { AlertCircleIcon } from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context.ts";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch";
import type { UserNotifications } from "@/types/user.ts";

interface NotificationsFormProps {
  notifications: UserNotifications;
  onNotificationsChange: (
    name: keyof UserNotifications,
    value: boolean,
  ) => void;
}

export function NotificationsForm({
  notifications,
  onNotificationsChange,
}: NotificationsFormProps) {
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
              checked={notifications.quiz_share}
              onCheckedChange={(checked) => {
                onNotificationsChange("quiz_share", checked);
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
              checked={notifications.issue_report}
              onCheckedChange={(checked) => {
                onNotificationsChange("issue_report", checked);
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
              checked={notifications.marketing}
              onCheckedChange={(checked) => {
                onNotificationsChange("marketing", checked);
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
