import { FlatList, Pressable, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";

export interface QuestionRow {
  id: string;
  title: string;
  subtitle: string;
}
export interface QuestionListProps {
  rows: QuestionRow[];
  selectedId: string;
  editing: boolean;
  moveUpLabel: string;
  moveDownLabel: string;
  onSelect: (id: string) => void;
  onMove: (id: string, beforeId: string | null) => void;
}
export default function QuestionList(props: QuestionListProps) {
  const c = useTheme();
  return (
    <FlatList
      data={props.rows}
      keyExtractor={(row) => row.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item, index }) => (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderColor: c.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === props.selectedId }}
            onPress={() => props.onSelect(item.id)}
            style={{ flex: 1, paddingVertical: 16, paddingHorizontal: 12 }}
          >
            <Text style={{ color: c.text, fontSize: 17 }}>{item.title}</Text>
            <Text
              numberOfLines={2}
              style={{ color: c.muted, fontSize: 15, marginTop: 4 }}
            >
              {item.subtitle}
            </Text>
          </Pressable>
          {props.editing && (
            <View style={{ flexDirection: "row" }}>
              {[-1, 1].map((direction) => {
                const disabled =
                  index + direction < 0 ||
                  index + direction >= props.rows.length;
                return (
                  <Pressable
                    key={direction}
                    accessibilityRole="button"
                    accessibilityLabel={`${direction < 0 ? props.moveUpLabel : props.moveDownLabel}: ${item.title}`}
                    accessibilityState={{ disabled }}
                    disabled={disabled}
                    style={{
                      padding: 12,
                      minWidth: 44,
                      minHeight: 44,
                      opacity: disabled ? 0.3 : 1,
                    }}
                    onPress={() =>
                      props.onMove(
                        item.id,
                        props.rows[index + (direction < 0 ? -1 : 2)]?.id ??
                          null,
                      )
                    }
                  >
                    <Text style={{ color: c.primary, fontSize: 20 }}>
                      {direction < 0 ? "↑" : "↓"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    />
  );
}
