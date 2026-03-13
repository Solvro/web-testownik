import { AlertCircleIcon } from "lucide-react";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PermissionAction } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE } from "@/types/user";
import type { SettingsFormProps } from "@/types/user";

export function NotificationsForm({
  settings,
  onSettingChange,
}: SettingsFormProps) {
  const { user, checkPermission } = useContext(AppContext);

  const canManageNotifications = checkPermission(
    PermissionAction.NOTIFICATION_SETTINGS,
  );

  return (
    <>
      {!canManageNotifications && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>
            {user?.account_type === ACCOUNT_TYPE.GUEST
              ? "Powiadomienia są niedostępne w trybie gościa."
              : "Powiadomienia są niedostępne dla Twojego typu konta."}
          </AlertTitle>
        </Alert>
      )}
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
                className={cn(
                  "text-sm font-medium",
                  !canManageNotifications && "text-muted-foreground",
                )}
                htmlFor="notify-quiz-share"
              >
                Udostępnienie quizu
              </Label>
              <p className="text-muted-foreground text-xs">
                Ktoś udostępnił Ci quiz
              </p>
            </div>
            <Switch
              id="notify-quiz-share"
              checked={settings.notify_quiz_shared}
              onCheckedChange={(checked) => {
                onSettingChange("notify_quiz_shared", checked);
              }}
              disabled={!canManageNotifications}
              className="ml-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label
                className={cn(
                  "text-sm font-medium",
                  !canManageNotifications && "text-muted-foreground",
                )}
                htmlFor="notify-bug-report"
              >
                Zgłoszenie problemu
              </Label>
              <p className="text-muted-foreground text-xs">
                Ktoś zgłosił problem z Twoim quizem
              </p>
            </div>
            <Switch
              id="notify-bug-report"
              checked={settings.notify_bug_reported}
              onCheckedChange={(checked) => {
                onSettingChange("notify_bug_reported", checked);
              }}
              disabled={!canManageNotifications}
              className="ml-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label
                className={cn(
                  "text-sm font-medium",
                  !canManageNotifications && "text-muted-foreground",
                )}
                htmlFor="notify-marketing"
              >
                Marketingowe
              </Label>
              <p className="text-muted-foreground text-xs">
                Otrzymuj powiadomienia o nowych funkcjonalnościach i ofertach
                specjalnych
              </p>
            </div>
            <Switch
              id="notify-marketing"
              checked={settings.notify_marketing}
              onCheckedChange={(checked) => {
                onSettingChange("notify_marketing", checked);
              }}
              disabled={!canManageNotifications}
              className="ml-auto"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
