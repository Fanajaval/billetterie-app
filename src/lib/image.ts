import { Image, Platform } from "react-native";
import * as FileSystem from "expo-file-system";

export async function resolveImageUri(uri: string): Promise<string> {
  if (Platform.OS === "web") return uri;

  if (uri.startsWith("file://")) return uri;

  const ext = uri.toLowerCase().includes(".png") ? "png" : "jpg";
  const dest = new FileSystem.File(
    FileSystem.Paths.cache,
    `ticket_${Date.now()}.${ext}`,
  );

  try {
    const source = new FileSystem.File(uri);
    source.copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export function readImageSize(
  uri: string,
  onSize: (w: number, h: number) => void,
  onFallback?: () => void,
) {
  Image.getSize(uri, onSize, () => {
    onFallback?.();
  });
}

export function getImageSizeAsync(
  uri: string,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (w, h) => resolve({ w, h }), reject);
  });
}
