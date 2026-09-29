import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";
import { useLocale } from "../../lib/locale";
import { useTheme } from "../../lib/theme";

export default function GradeSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useTheme(),
    { t } = useLocale();
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        {/* Standard sheet header: centred title, Done on the trailing side. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 52,
            paddingHorizontal: 72,
          }}
        >
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{ fontSize: 17, fontWeight: "600", color: c.text }}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Zamknij", "Close")}
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => ({
              position: "absolute",
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.fill,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SymbolView
              name="xmark"
              size={15}
              weight="semibold"
              tintColor={c.text}
              fallback={<Text style={{ color: c.text, fontSize: 17 }}>✕</Text>}
            />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 40,
            gap: 16,
            maxWidth: 760,
            width: "100%",
            alignSelf: "center",
          }}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
