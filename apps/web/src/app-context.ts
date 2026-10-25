"use client";

import { createContext } from "react";

import type { AppContextType } from "./app-context-type";

export const AppContext = createContext<AppContextType>({
  isAuthenticated: false,
  user: null,
  checkPermission: () => false,
});
