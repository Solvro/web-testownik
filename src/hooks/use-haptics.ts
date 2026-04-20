import { useCallback, useEffect, useState } from "react";
import { useWebHaptics } from "web-haptics/react";

type HapticPreset = "success" | "warning" | "error" | "selection";

export const useHaptics = () => {
  const { trigger, isSupported } = useWebHaptics();

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const saved = localStorage.getItem("use-haptics");
    return saved === null ? true : saved === "true";
  });

  const setHapticsEnabled = useCallback((value: boolean) => {
    localStorage.setItem("use-haptics", String(value));
    setIsEnabled(value);

    window.dispatchEvent(new Event("storage-update"));
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem("use-haptics");
      setIsEnabled(saved === null ? true : saved === "true");
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("storage-update", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("storage-update", handleStorageChange);
    };
  }, []);

  const vibrate = useCallback(
    async (pattern: HapticPreset | number | number[]) => {
      if (!isSupported || !isEnabled) {
        return;
      }

      try {
        await trigger(pattern);
      } catch (error) {
        console.warn("Haptics not supported", error);
      }
    },
    [isSupported, isEnabled, trigger],
  );

  return { vibrate, isEnabled, setHapticsEnabled };
};
