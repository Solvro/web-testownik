import { UAParser } from "ua-parser-js";

export const getDeviceFriendlyName = () => {
  const parser = new UAParser();
  const ua = parser.getResult();
  if (ua.device.type === "tablet")
    return ua.device.model === "iPad" ? "iPad" : "Tablet";
  if (ua.device.type === "mobile")
    return ua.os.name === "iOS" ? "iPhone" : "Telefon";
  if (ua.os.name === "Mac OS") return "Mac";
  if (ua.os.name === "Windows") return "Windows PC";
  return "Komputer";
};

export const getDeviceType = () => {
  const parser = new UAParser();
  const ua = parser.getResult();
  return ua.device.type || "desktop";
};
