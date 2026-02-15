"use client";

import { createContext } from "react";

interface ExternalImageContextType {
  externalImagesApproved: boolean;
  isInitialized: boolean;
}

export const ExternalImageContext = createContext<ExternalImageContextType>({
  externalImagesApproved: false,
  isInitialized: false,
});
