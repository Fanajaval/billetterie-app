import * as Crypto from "expo-crypto";
import CryptoJS from "crypto-js";
import nacl from "tweetnacl";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  secureRandomWordArray,
  sha256Hex,
  utf8ToBytes,
} from "./crypto";

export const TICKET_APP_ID = "B";
export const TICKET_FORMAT_VERSION = 3;
export const TICKET_SECRET = "BILLETTERIE_SECRET_2026";
export const DEFAULT_EVENT_ID = "EVT-001";
export const QR_PREFIX = "BLT1";
const LEGACY_APP_ID = "BILLETTERIE";
const LEGACY_FORMAT_VERSION = 2;
const LEGACY_SIGNATURE_LENGTH = 32;
const SIGNING_KEY_SEED = "BILLETTERIE_ED25519_PRIVATE_SEED_2026";
const SIGNING_KEY_ID = "A";

type QrPayload = {
  v?: number;
  a?: string;
  t?: string;
  e?: string;
  s?: string;
  k?: string;
  n?: string;
};

export type TicketValidation =
  | { valid: true; ticket: string; eventId: string }
  | { valid: false; reason: string };

function encryptionKey(): CryptoJS.lib.WordArray {
  return CryptoJS.SHA256(TICKET_SECRET);
}

function deriveSigningSeed(): Uint8Array {
  const seedHex = CryptoJS.SHA256(SIGNING_KEY_SEED)
    .toString(CryptoJS.enc.Hex)
    .slice(0, 64);
  const bytes = new Uint8Array(32);

  for (let i = 0; i < 32; i += 1) {
    bytes[i] = parseInt(seedHex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function signingKeyPair() {
  return nacl.sign.keyPair.fromSeed(deriveSigningSeed());
}

function canonicalPayload(
  ticketNumber: string,
  eventId: string,
  nonce: string,
): string {
  return [
    TICKET_FORMAT_VERSION,
    TICKET_APP_ID,
    SIGNING_KEY_ID,
    eventId,
    ticketNumber,
    nonce,
  ].join("|");
}

function signDetachedPayload(
  ticketNumber: string,
  eventId: string,
  nonce: string,
): string {
  const message = utf8ToBytes(canonicalPayload(ticketNumber, eventId, nonce));
  const signature = nacl.sign.detached(message, signingKeyPair().secretKey);
  return bytesToBase64Url(signature);
}

function verifyDetachedPayload(
  ticketNumber: string,
  eventId: string,
  nonce: string,
  signature: string,
): boolean {
  try {
    const message = utf8ToBytes(canonicalPayload(ticketNumber, eventId, nonce));
    return nacl.sign.detached.verify(
      message,
      base64UrlToBytes(signature),
      signingKeyPair().publicKey,
    );
  } catch {
    return false;
  }
}

function createNonce(): string {
  return bytesToBase64Url(
    new Uint8Array(Crypto.getRandomValues(new Uint8Array(16))),
  );
}

function toBase64Url(wordArray: CryptoJS.lib.WordArray): string {
  return CryptoJS.enc.Base64.stringify(wordArray)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): CryptoJS.lib.WordArray {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return CryptoJS.enc.Base64.parse(base64 + pad);
}

async function encryptPayload(plaintext: string): Promise<string> {
  const iv = await secureRandomWordArray(16);
  const encrypted = CryptoJS.AES.encrypt(plaintext, encryptionKey(), {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return `${QR_PREFIX}.${toBase64Url(iv)}.${toBase64Url(encrypted.ciphertext)}`;
}

function decryptPayload(raw: string): string | null {
  if (!raw.startsWith(`${QR_PREFIX}.`)) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  try {
    const iv = fromBase64Url(parts[1]);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: fromBase64Url(parts[2]),
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, encryptionKey(), {
      iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    return plaintext || null;
  } catch {
    return null;
  }
}

export async function signTicket(
  ticketNumber: string,
  eventId: string,
): Promise<string> {
  const base = `${LEGACY_FORMAT_VERSION}|${LEGACY_APP_ID}|${ticketNumber}|${eventId}`;
  return sha256Hex(`${base}|${TICKET_SECRET}`);
}

async function buildSignedPayload(
  ticketNumber: string,
  eventId: string,
): Promise<string> {
  const nonce = createNonce();
  const signature = signDetachedPayload(ticketNumber, eventId, nonce);
  return JSON.stringify({
    v: TICKET_FORMAT_VERSION,
    a: TICKET_APP_ID,
    t: ticketNumber,
    e: eventId,
    n: nonce,
    k: SIGNING_KEY_ID,
    s: signature,
  });
}

export async function buildQrPayload(
  ticketNumber: string,
  eventId = DEFAULT_EVENT_ID,
): Promise<string> {
  const signed = await buildSignedPayload(ticketNumber, eventId);
  return await encryptPayload(signed);
}

function parsePayload(raw: string): QrPayload | null {
  try {
    const data = JSON.parse(raw) as QrPayload;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

async function validateDecryptedPayload(
  data: QrPayload,
): Promise<TicketValidation> {
  if (data.a !== TICKET_APP_ID && data.a !== LEGACY_APP_ID) {
    return {
      valid: false,
      reason: "Ce QR n'a pas été généré par Billetterie.",
    };
  }

  if (!data.t || !data.e || !data.s) {
    return { valid: false, reason: "Billet incomplet ou falsifié." };
  }

  if (data.v === TICKET_FORMAT_VERSION) {
    if (!data.n || !data.k) {
      return { valid: false, reason: "Billet incomplet ou falsifié." };
    }

    if (data.k !== SIGNING_KEY_ID) {
      return { valid: false, reason: "Clé de signature inconnue." };
    }

    if (!verifyDetachedPayload(data.t, data.e, data.n, data.s)) {
      return { valid: false, reason: "Signature invalide — billet refusé." };
    }

    return { valid: true, ticket: data.t, eventId: data.e };
  }

  if (data.v === LEGACY_FORMAT_VERSION) {
    const expected = (await signTicket(data.t, data.e)).slice(
      0,
      LEGACY_SIGNATURE_LENGTH,
    );
    if (data.s !== expected) {
      return { valid: false, reason: "Signature invalide — billet refusé." };
    }

    return { valid: true, ticket: data.t, eventId: data.e };
  }

  return { valid: false, reason: "Version de billet non supportée." };
}

export async function validateQrContent(
  raw: string,
): Promise<TicketValidation> {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, reason: "QR vide ou illisible." };
  }

  if (!trimmed.startsWith(`${QR_PREFIX}.`)) {
    return {
      valid: false,
      reason:
        "QR non reconnu. Seule l'application Billetterie peut lire ces billets.",
    };
  }

  const plaintext = decryptPayload(trimmed);
  if (!plaintext) {
    return { valid: false, reason: "Billet illisible ou falsifié." };
  }

  const data = parsePayload(plaintext);
  if (!data) {
    return { valid: false, reason: "Billet corrompu ou falsifié." };
  }

  return validateDecryptedPayload(data);
}
