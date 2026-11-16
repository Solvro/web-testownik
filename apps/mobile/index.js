// Keep Metro's web refresh setup first, as in Expo Router's standard entry.
import "@expo/metro-runtime";
import React from "react";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";

import { SessionProvider } from "./src/lib/session";

// Browser back/deep links can reset the router's root layout. Account state
// and acknowledged deletion recovery must outlive those navigation resets.
function Testownik() {
  return React.createElement(SessionProvider, null, React.createElement(App));
}

renderRootComponent(Testownik);
