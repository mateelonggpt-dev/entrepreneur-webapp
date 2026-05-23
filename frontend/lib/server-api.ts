import { fetchBootstrapData } from "@/lib/api";
import { fallbackAppData } from "@/lib/fallback-data";
import type { AppData } from "@/lib/types";

export async function getBootstrapData(): Promise<AppData> {
  try {
    return await fetchBootstrapData();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown backend error.";
    console.warn(
      `Using fallback app data because the Flask backend bootstrap request failed: ${detail}`
    );
    return fallbackAppData;
  }
}
