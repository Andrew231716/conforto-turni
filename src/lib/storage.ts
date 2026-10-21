import type { AppData } from "./types";
import { normalizeAppData } from "./types";
import { createSeedData } from "./seed";

const STORAGE_KEY = "conforto-turni-v1";

export function loadAppData(): AppData {
  if (typeof window === "undefined") return createSeedData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return normalizeAppData(JSON.parse(raw) as AppData);
  } catch {
    return createSeedData();
  }
}

export function saveAppData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function exportAppDataJson(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function importAppDataJson(json: string): AppData {
  const parsed = JSON.parse(json) as AppData;
  if (!parsed?.people || !parsed?.programs) {
    throw new Error("File non valido: mancano people/programs");
  }
  return normalizeAppData(parsed);
}

export function resetToSeed(): AppData {
  const seed = createSeedData();
  saveAppData(seed);
  return seed;
}
