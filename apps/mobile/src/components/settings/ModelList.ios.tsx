import { fill, rowLabel, secondary } from "../quiz-list/QuizRow";
import {
  Button,
  Host,
  HStack,
  Image,
  List,
  Section,
  Text,
  VStack,
} from "@expo/ui/swift-ui";
import { font, frame, listStyle } from "@expo/ui/swift-ui/modifiers";

import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";
import type { ModelListProps } from "./ModelList.types";

const PROVIDERS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  xai: "xAI",
};

/** A Settings-style choice list: one row per model, grouped by provider. */
export default function ModelList({
  models,
  selected,
  select,
  defaultModel,
}: ModelListProps) {
  const c = useTheme();
  const { t } = useLocale();
  const groups = [...new Set(models.map((model) => model.provider ?? ""))];
  const row = (
    value: string | null,
    label: string,
    provider?: string,
    detail?: string,
  ) => (
    <Button
      key={value ?? "default"}
      onPress={() => select(value)}
      modifiers={[rowLabel]}
    >
      <HStack spacing={12}>
        {provider ? (
          <Image
            assetName={`provider-${provider}`}
            modifiers={[frame({ width: 22, height: 22 })]}
          />
        ) : null}
        <VStack alignment="leading" spacing={2} modifiers={[fill]}>
          <Text>{label}</Text>
          {detail ? (
            <Text modifiers={[font({ textStyle: "footnote" }), secondary]}>
              {detail}
            </Text>
          ) : null}
        </VStack>
        {selected === value ? (
          <Image systemName="checkmark" size={16} color={c.primary} />
        ) : null}
      </HStack>
    </Button>
  );
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle("insetGrouped")]}>
        <Section
          footer={
            <Text>
              {t(
                "Domyślny model wybiera Testownik i może się zmieniać.",
                "Testownik picks the default model, and it may change over time.",
              )}
            </Text>
          }
        >
          {row(
            null,
            t("Domyślny", "Default"),
            defaultModel?.provider,
            defaultModel?.label,
          )}
        </Section>
        {groups.map((provider) => (
          <Section key={provider} title={PROVIDERS[provider] ?? provider}>
            {models
              .filter((model) => (model.provider ?? "") === provider)
              .map((model) => row(model.value, model.label, model.provider))}
          </Section>
        ))}
      </List>
    </Host>
  );
}
