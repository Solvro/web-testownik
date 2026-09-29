import { FilledTonalIconButton, Icon } from "@expo/ui/jetpack-compose";

import type { EditorActionProps } from "./EditorAction";
import M3Host from "./M3Host";
import { symbol } from "./materialIcons.android";

// Material 3 filled tonal icon button (40dp, full-round).
export default function EditorAction({
  label,
  action,
  disabled,
  onPress,
}: EditorActionProps) {
  return (
    <M3Host matchContents>
      <FilledTonalIconButton
        key={String(Boolean(disabled))}
        enabled={!disabled}
        onClick={onPress}
      >
        <Icon
          contentDescription={label}
          source={symbol(
            action === "edit"
              ? "edit"
              : action === "add"
                ? "plus"
                : action === "next"
                  ? "chevronRight"
                  : "chevronLeft",
          )}
        />
      </FilledTonalIconButton>
    </M3Host>
  );
}
