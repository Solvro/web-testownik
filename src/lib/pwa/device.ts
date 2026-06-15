export interface PwaPlatform {
  isIos: boolean;
  isMacSafari: boolean;
  isAndroid: boolean;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  // Primary check for iOS devices
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return true;
  }

  // Modern iPadOS (as of iOS 13+) may present as Mac, so we infer by touch support and user agent
  const isMacIntelWithTouch =
    navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1;

  return isMacIntelWithTouch;
}

export function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return isIosDevice() || /Android/i.test(navigator.userAgent);
}

export function getPwaPlatform(): PwaPlatform {
  if (typeof navigator === "undefined") {
    return { isIos: false, isMacSafari: false, isAndroid: false };
  }

  const isIos = isIosDevice();
  const isMac = navigator.userAgent.includes("Macintosh");
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  return {
    isIos,
    isMacSafari: isMac && isSafari,
    isAndroid,
  };
}
