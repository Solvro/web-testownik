import DOMPurify from "dompurify";
import { XIcon } from "lucide-react";
import React from "react";

import { AppContext } from "@/app-context.ts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button.tsx";
import type { AlertData } from "@/types/alert.ts";

export function Alerts(): React.JSX.Element | null {
  const appContext = React.useContext(AppContext);
  const [alerts, setAlerts] = React.useState<AlertData[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = React.useState<string[]>(() => {
    const stored = localStorage.getItem("dismissedAlerts");
    return stored === null ? [] : (JSON.parse(stored) as string[]);
  });

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts([...dismissedAlerts, alertId]);
    localStorage.setItem(
      "dismissedAlerts",
      JSON.stringify([...dismissedAlerts, alertId]),
    );
  };

  React.useEffect(() => {
    appContext.services.user
      .getAlerts()
      .then((fetchedAlerts) => {
        setAlerts(fetchedAlerts);
      })
      .catch((error: unknown) => {
        console.error("Failed to fetch alerts:", error);
      });
  }, [appContext.services.user]);

  if (
    alerts.every(
      (alert) =>
        (dismissedAlerts.includes(alert.id) || !alert.active) &&
        alert.dismissible,
    )
  ) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      {alerts.map(
        (alert) =>
          (!dismissedAlerts.includes(alert.id) || !alert.dismissible) &&
          alert.active && (
            <Alert
              key={alert.id}
              variant={
                alert.color === "danger" || alert.color === "warning"
                  ? "destructive"
                  : "default"
              }
              className="relative pr-10"
            >
              {alert.dismissible ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Zamknij"
                  onClick={() => {
                    dismissAlert(alert.id);
                  }}
                  className="text-muted-foreground hover:text-foreground absolute top-0 right-0 m-1 transition-colors"
                >
                  <XIcon className="size-4" />
                </Button>
              ) : null}
              {alert.title ? <AlertTitle>{alert.title}</AlertTitle> : null}
              <AlertDescription>
                <div
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(alert.content),
                  }}
                  className="[&_a]:underline"
                />
              </AlertDescription>
            </Alert>
          ),
      )}
    </div>
  );
}
