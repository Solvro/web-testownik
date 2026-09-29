import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";

import { useTheme } from "../lib/theme";
import { Button } from "./ui";

export interface OverflowProps {
  label?: string;
  glass?: boolean;
  muted?: boolean;
  icon?: "ellipsis-horizontal" | "add" | "sort";
  items: {
    title: string;
    onPress: () => void | Promise<void>;
    destructive?: boolean;
    disabled?: boolean;
    selected?: boolean;
    /** SF Symbol shown on iOS. */
    symbol?: string;
  }[];
}
export default function Overflow({
  items,
  label = "Opcje",
  icon = "ellipsis-horizontal",
}: OverflowProps) {
  const [open, setOpen] = useState(false);
  const c = useTheme();
  const anchor = useRef<View>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const { width, height } = useWindowDimensions();
  return (
    <View ref={anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() =>
          anchor.current?.measureInWindow((x, y) => {
            setPosition({ x, y });
            setOpen(true);
          })
        }
        style={{
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon === "sort" ? "swap-vertical" : icon}
          size={24}
          color={c.text}
        />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel="Zamknij menu"
          style={{ flex: 1 }}
          onPress={() => setOpen(false)}
        />
        <View
          style={{
            position: "absolute",
            top: Math.min(position.y + 48, height - items.length * 48 - 24),
            left: Math.max(12, Math.min(position.x - 220, width - 292)),
            width: 280,
            padding: 8,
            backgroundColor: c.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            boxShadow: "0 6px 24px #0002",
          }}
        >
          {items.map((i) => (
            <Button
              key={i.title}
              kind={i.destructive ? "danger" : "secondary"}
              disabled={i.disabled}
              onPress={async () => {
                setOpen(false);
                await i.onPress();
              }}
            >
              {i.title}
            </Button>
          ))}
        </View>
      </Modal>
    </View>
  );
}
