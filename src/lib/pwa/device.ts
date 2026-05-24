export interface PwaPlatform {
  isIos: boolean;
  isMacSafari: boolean;
  isAndroid: boolean;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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
  const isMac = /Macintosh/.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  return {
    isIos,
    isMacSafari: isMac && isSafari,
    isAndroid,
  };
}
