import type { DocumentPickerAsset } from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

/** Inspect the copied file before reading its contents into memory. */
export function openImportFile(
  asset: Pick<DocumentPickerAsset, "uri" | "file">,
  t: (pl: string, en: string) => string,
) {
  const file = Platform.OS === "web" ? asset.file : new File(asset.uri);
  if (!file || !Number.isFinite(file.size) || file.size < 0)
    throw new Error(t("Nie można odczytać pliku.", "Cannot read this file."));
  if (file.size > 20_000_000)
    throw new Error(
      t(
        "Maksymalny rozmiar pliku to 20 MB.",
        "The maximum file size is 20 MB.",
      ),
    );
  return file;
}
