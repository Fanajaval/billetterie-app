import { createContext, useContext } from "react";

import type { ThemeMode } from "./lib/settings";

const lightColors = {
  bg: "#f1f5f9",
  surface: "#ffffff",
  surfaceAlt: "#eef2ff",
  surfaceSoft: "#f8fafc",
  primary: "#1d4ed8",
  primaryLight: "#dbeafe",
  qr: "#2563eb",
  qrBg: "rgba(37,99,235,0.12)",
  num: "#dc2626",
  numBg: "rgba(220,38,38,0.12)",
  text: "#0f172a",
  textMuted: "#64748b",
  textOnPrimary: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  success: "#16a34a",
  successBg: "rgba(22,163,74,0.12)",
  warning: "#d97706",
  warningBg: "rgba(217,119,6,0.14)",
  overlay: "rgba(15,23,42,0.4)",
  canvas: "#cbd5e1",
  canvasSurface: "#ffffff",
  shadow: "#000000",
};

const darkColors = {
  bg: "#020617",
  surface: "#0f172a",
  surfaceAlt: "#172554",
  surfaceSoft: "#111c33",
  primary: "#60a5fa",
  primaryLight: "rgba(96,165,250,0.16)",
  qr: "#60a5fa",
  qrBg: "rgba(96,165,250,0.16)",
  num: "#f87171",
  numBg: "rgba(248,113,113,0.16)",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textOnPrimary: "#e0f2fe",
  border: "#1e293b",
  borderStrong: "#334155",
  success: "#4ade80",
  successBg: "rgba(74,222,128,0.16)",
  warning: "#f59e0b",
  warningBg: "rgba(245,158,11,0.18)",
  overlay: "rgba(2,6,23,0.7)",
  canvas: "#1e293b",
  canvasSurface: "#ffffff",
  shadow: "#000000",
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export type AppTheme = {
  mode: Exclude<ThemeMode, "system">;
  colors: typeof lightColors;
  radius: typeof radius;
};

export const ThemeContext = createContext<AppTheme>({
  mode: "light",
  colors: lightColors,
  radius,
});

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}

export function buildTheme(mode: Exclude<ThemeMode, "system">): AppTheme {
  return {
    mode,
    colors: mode === "dark" ? darkColors : lightColors,
    radius,
  };
}

export const colors = lightColors; // legacy export kept for compatibility; prefer useAppTheme()
