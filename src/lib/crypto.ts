import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";

export async function sha256Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}

export async function secureRandomWordArray(
  byteCount: number,
): Promise<CryptoJS.lib.WordArray> {
  const bytes = Crypto.getRandomBytes(byteCount);
  const words: number[] = [];

  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] ?? 0) << 24) |
        ((bytes[i + 1] ?? 0) << 16) |
        ((bytes[i + 2] ?? 0) << 8) |
        (bytes[i + 3] ?? 0),
    );
  }

  return CryptoJS.lib.WordArray.create(words, byteCount);
}

export function utf8ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "utf8"));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return new Uint8Array(Buffer.from(base64 + pad, "base64"));
}
