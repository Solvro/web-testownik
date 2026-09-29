import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenuAction,
} from "expo-router";
import type { ReactElement } from "react";
import { Platform, View } from "react-native";

import { notify } from "../lib/alerts";
import { type Translate, userError, failureTitle } from "../lib/user-error";
import Overflow, { type OverflowProps } from "./Overflow";

// The custom control owns its circular glass background. Avoid a second,
// wider UIKit bar-item background around it.
export function headerAction(render: () => ReactElement) {
  return {
    headerRight: render,
    unstable_headerRightItems:
      Platform.OS === "ios"
        ? () => [
            {
              type: "custom" as const,
              element: render(),
              hidesSharedBackground: true,
            },
          ]
        : undefined,
  };
}

type SymbolName = Extract<
  NonNullable<NativeStackHeaderItemMenuAction["icon"]>,
  { type: "sfSymbol" }
>["name"];

export interface MenuAction {
  title: string;
  /** SF Symbol shown beside the title on iOS. */
  icon?: SymbolName;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
  selected?: boolean;
}

export interface HeaderMenu {
  label: string;
  /** SF Symbol for the bar button on iOS. */
  icon: SymbolName;
  /** Fallback glyph for the browser preview and Android. */
  fallbackIcon?: OverflowProps["icon"];
  /** Each inner array is one visually separated group. */
  sections: MenuAction[][];
}

/**
 * Native bar-button menus on iOS: system glass, grouped background, SF Symbols
 * and separated sections come from UIKit. Other platforms keep the JS menu.
 */
export function headerMenus(menus: HeaderMenu[], t: Translate) {
  const run = (action: MenuAction) => () => {
    void Promise.resolve()
      .then(action.onPress)
      .catch((error: unknown) =>
        notify(failureTitle(t, action.title), userError(error, t)),
      );
  };
  const toItem = (action: MenuAction): NativeStackHeaderItemMenuAction => ({
    type: "action" as const,
    label: action.title,
    icon: action.icon
      ? { type: "sfSymbol" as const, name: action.icon }
      : undefined,
    destructive: action.destructive,
    disabled: action.disabled,
    state: action.selected ? ("on" as const) : undefined,
    onPress: run(action),
  });
  return {
    headerRight: () => (
      <View style={{ flexDirection: "row" }}>
        {menus.map((menu) => (
          <Overflow
            key={menu.label}
            glass
            label={menu.label}
            icon={menu.fallbackIcon}
            items={menu.sections.flat().map((action) => ({
              ...action,
              onPress: run(action),
            }))}
          />
        ))}
      </View>
    ),
    unstable_headerRightItems:
      Platform.OS === "ios"
        ? () =>
            menus.map(
              (menu): NativeStackHeaderItem => ({
                type: "menu" as const,
                label: menu.label,
                accessibilityLabel: menu.label,
                icon: { type: "sfSymbol" as const, name: menu.icon },
                menu: {
                  items:
                    menu.sections.length === 1
                      ? menu.sections[0].map(toItem)
                      : menu.sections.map((section) => ({
                          type: "submenu" as const,
                          label: "",
                          inline: true,
                          items: section.map(toItem),
                        })),
                },
              }),
            )
        : undefined,
  };
}
