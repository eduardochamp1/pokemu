import { useSyncExternalStore } from "react";

export interface JournalItem { id: string; text: string; at: number; done?: boolean }
export interface PersonalAdventure {
  rom: string;
  favorite: boolean;
  slotNames: string[];
  notes: JournalItem[];
  goals: JournalItem[];
  guide?: { title: string; text: string; source: string };
}
export const PERSONAL_KEY = "pokedex:personal-adventures";
const EMPTY: PersonalAdventure = { rom: "", favorite: false, slotNames: [], notes: [], goals: [] };
let entries: PersonalAdventure[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

export function validPersonalAdventure(value: unknown): value is PersonalAdventure {
  if (!value || typeof value !== "object") return false;
  const entry = value as PersonalAdventure;
  const items = (value: JournalItem[], limit: number) => Array.isArray(value) && value.length <= limit && new Set(value.map(item => item?.id)).size === value.length && value.every(item => item && typeof item.id === "string" && typeof item.text === "string" && item.text.length <= 4000 && Number.isFinite(item.at) && Number.isFinite(new Date(item.at).getTime()) && (item.done === undefined || typeof item.done === "boolean"));
  const validSource = (source: unknown) => {
    if (typeof source !== "string" || source.length > 2000) return false;
    if (!source) return true;
    try { return ["http:", "https:"].includes(new URL(source).protocol); } catch { return false; }
  };
  return typeof entry.rom === "string" && entry.rom.length > 0 && typeof entry.favorite === "boolean"
    && Array.isArray(entry.slotNames) && entry.slotNames.length <= 6 && entry.slotNames.every(name => typeof name === "string" && name.length <= 80)
    && items(entry.notes, 500) && items(entry.goals, 100)
    && (!entry.guide || (typeof entry.guide.title === "string" && entry.guide.title.length <= 200 && typeof entry.guide.text === "string" && entry.guide.text.length <= 300_000 && validSource(entry.guide.source)));
}
export function reloadPersonalAdventures() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PERSONAL_KEY) ?? "[]");
    entries = Array.isArray(value) ? value.filter(validPersonalAdventure) : [];
  } catch { entries = []; }
  notify();
}
reloadPersonalAdventures();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const storage = (event: StorageEvent) => { if (event.key === PERSONAL_KEY || event.key === null) reloadPersonalAdventures(); };
  window.addEventListener("storage", storage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", storage); };
}
export function usePersonalAdventures() { return useSyncExternalStore(subscribe, () => entries, () => entries); }
export function usePersonalAdventure(rom?: string) { return usePersonalAdventures().find(entry => entry.rom === rom) ?? EMPTY; }
export function updatePersonalAdventure(rom: string, patch: Partial<Omit<PersonalAdventure, "rom">>) {
  const entry = { ...(entries.find(entry => entry.rom === rom) ?? EMPTY), ...patch, rom };
  if (!validPersonalAdventure(entry)) throw new Error("Invalid adventure data");
  const next = [...entries.filter(entry => entry.rom !== rom), entry];
  // Publica só depois de persistir: falhas de quota não fingem ter salvado.
  localStorage.setItem(PERSONAL_KEY, JSON.stringify(next));
  entries = next;
  notify();
}
