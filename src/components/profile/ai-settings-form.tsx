import { useContext } from "react";

import { AppContext } from "@/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PermissionAction } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import type { SettingsFormProps } from "@/types/user";

export function AiSettingsForm({
  settings,
  onSettingChange,
}: SettingsFormProps) {
  const { checkPermission } = useContext(AppContext);

  const hasAiAccess = checkPermission(PermissionAction.AI_FEATURES);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sztuczna inteligencja</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div>
            <Label
              className={cn(
                "text-sm font-medium",
                !hasAiAccess && "text-muted-foreground",
              )}
              htmlFor="ai-disabled"
            >
              Wyłącz funkcje AI
            </Label>
            <p className="text-muted-foreground text-xs">
              Ukryj generowanie quizów, czat AI, podpowiedzi i wszystkie inne
              funkcje AI
            </p>
          </div>
          <Switch
            id="ai-disabled"
            checked={settings.ai_disabled}
            onCheckedChange={(checked) => {
              onSettingChange("ai_disabled", checked);
            }}
            disabled={!hasAiAccess}
            className="ml-auto"
          />
        </div>
      </CardContent>
    </Card>
  );
}
