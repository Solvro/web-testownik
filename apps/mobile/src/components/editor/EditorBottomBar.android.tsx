import {
  Button,
  Icon,
  IconButton,
  Row,
  Spacer,
  Text,
  TextButton,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth, weight } from "@expo/ui/jetpack-compose/modifiers";

import { useLocale } from "../../lib/locale";
import M3Host from "../native/M3Host";
import { symbol } from "../native/materialIcons.android";
import type { EditorBottomBarProps } from "./EditorBottomBar";

// Material 3 bottom app bar: navigation and add as icon actions on the
// leading side, the question position opens the question list, and Save is
// the bar's primary action on the trailing side.
export default function EditorBottomBar(p: EditorBottomBarProps) {
  const { t } = useLocale();
  return (
    <M3Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <IconButton
          key={`p${p.canPrevious && !p.disabled}`}
          enabled={p.canPrevious && !p.disabled}
          onClick={p.previous}
        >
          <Icon
            source={symbol("chevronLeft")}
            contentDescription={t("Poprzednie pytanie", "Previous Question")}
          />
        </IconButton>
        <TextButton enabled={!p.disabled} onClick={p.openList}>
          <Text modifiers={[]} style={{ typography: "labelLarge" }}>
            {p.position}
          </Text>
        </TextButton>
        <IconButton
          key={`n${p.canNext && !p.disabled}`}
          enabled={p.canNext && !p.disabled}
          onClick={p.next}
        >
          <Icon
            source={symbol("chevronRight")}
            contentDescription={t("Następne pytanie", "Next Question")}
          />
        </IconButton>
        <IconButton enabled={!p.disabled} onClick={p.add}>
          <Icon
            source={symbol("plus")}
            contentDescription={t("Dodaj pytanie", "Add Question")}
          />
        </IconButton>
        <Spacer modifiers={[weight(1)]} />
        <Button
          key={`s${p.saveDisabled}`}
          enabled={!p.saveDisabled}
          onClick={p.save}
        >
          <Text>{p.saveLabel}</Text>
        </Button>
      </Row>
    </M3Host>
  );
}
