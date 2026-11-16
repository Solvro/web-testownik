import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { api } from "./api";

interface UploadedImage {
  id: string;
  url?: string;
  width?: number;
  height?: number;
}

export async function pickImage<T = UploadedImage>(
  endpoint = "upload/",
  field = "image",
) {
  const client = api.forSession();
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return null;
  const asset = result.assets[0],
    body = new FormData();
  if (Platform.OS === "web") {
    const blob = await fetch(asset.uri).then((r) => r.blob());
    body.append(field, blob, asset.fileName ?? "photo.jpg");
  } else {
    // Expo's fetch serializes Blob/File bytes, not RN's legacy uri objects.
    body.append(field, new File(asset.uri));
  }
  return client.request<T>(endpoint, {
    method: "POST",
    body,
  });
}
export async function exportJson(name: string, value: unknown) {
  const content = JSON.stringify(value, null, 2);
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const path = `${FileSystem.cacheDirectory}${name.replace(/[^a-z0-9_-]/gi, "_")}.json`;
  await FileSystem.writeAsStringAsync(path, content);
  await Sharing.shareAsync(path, {
    mimeType: "application/json",
    UTI: "public.json",
  });
}
