import { useState } from "react";
import { View } from "react-native";

import { useLocale } from "../../lib/locale";
import { errorKind, userError } from "../../lib/user-error";
import { KINDS } from "../ui";
import Spinner from "./Spinner";
import { StatusContent } from "./StatusView.android";
import type { StatusViewProps } from "./StatusView.types";

// Empty and error states that live inside a list's scroll view (as its
// ListEmptyComponent), so pull-to-refresh and the list header stay usable.

export function ListEmpty(props: Omit<StatusViewProps, "testID" | "symbol">) {
  return (
    <View
      style={{ flexGrow: 1, justifyContent: "center", paddingVertical: 48 }}
    >
      <StatusContent {...props} />
    </View>
  );
}

/** A list whose content failed to load at all. */
export function ListError({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const { t } = useLocale();
  // A retry that fails again produces a new error object, so "retrying" ends
  // on its own without tracking the request.
  const [retried, setRetried] = useState<unknown>(null);
  const kind = KINDS[errorKind(error)];
  if (retried === error)
    return (
      <View
        style={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 48,
        }}
      >
        <Spinner label={t("Wczytywanie", "Loading")} />
      </View>
    );
  return (
    <ListEmpty
      ionicon={kind.ionicon}
      title={t(...kind.title)}
      description={userError(error, t)}
      actions={
        retry
          ? [
              {
                label: t("Spróbuj ponownie", "Try Again"),
                onPress: () => {
                  setRetried(error);
                  retry();
                },
              },
            ]
          : []
      }
    />
  );
}
