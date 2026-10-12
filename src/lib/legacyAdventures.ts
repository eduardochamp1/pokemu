import { useSyncExternalStore } from "react";
import type { LegacyMon, LegacySave } from "../emulator/saveParse/legacy";

export interface LegacyEvent {
  at: number;
  kind: "start" | "captured" | "badge" | "rewind";
  value?: number;
}
export interface LegacyAdventure {
  rom: string;
  updatedAt: number;
  save: LegacySave;
  events: LegacyEvent[];
}
const KEY = "pokedex:legacy-adventures";
const listeners = new Set<() => void>();
let entries: LegacyAdventure[] = [];
const notify = () => listeners.forEach(fn => fn());
const numbers = (v: unknown, max: number): v is number[] => Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 1 && n <= max);
export function isLegacyAdventure(value: unknown): value is LegacyAdventure {
  if (!value || typeof value !== "object") return false;
  const e = value as LegacyAdventure, s = e.save;
  if (!s || (s.generation !== 1 && s.generation !== 2) || typeof s.playerName !== "string" || !s.trainer || !s.pokedex || !s.boxes) return false;
  const games = s.generation === 1 ? ["red", "green", "blue", "yellow"] : ["gold", "silver", "crystal"];
  const max = s.generation === 1 ? 151 : 251;
  const spread = (v: LegacyMon["dvs"], limit: number) => v && [v.hp, v.atk, v.def, v.spe, v.special].every(n => Number.isInteger(n) && n >= 0 && n <= limit);
  const mon = (m: LegacyMon) => m && typeof m.nickname === "string" && typeof m.originalTrainer === "string" && Number.isInteger(m.trainerId) && Number.isInteger(m.national) && m.national >= 1 && m.national <= max &&
    (m.level === null || (Number.isInteger(m.level) && m.level >= 1 && m.level <= 100)) && Number.isInteger(m.experience) && typeof m.egg === "boolean" && (m.shiny === null || typeof m.shiny === "boolean") &&
    (m.friendship === null || (Number.isInteger(m.friendship) && m.friendship >= 0 && m.friendship <= 255)) &&
    (m.heldItem === null || Number.isInteger(m.heldItem)) && spread(m.dvs, 15) && spread(m.statExperience, 65535) &&
    (m.stats === null || (m.stats && [m.stats.hp, m.stats.maxHp, m.stats.atk, m.stats.def, m.stats.spe].every(n => Number.isInteger(n) && n >= 0))) &&
    Array.isArray(m.moves) && m.moves.length <= 4 && m.moves.every(move => move && Number.isInteger(move.id) && move.id >= 1 && move.id <= (s.generation === 1 ? 165 : 251) && Number.isInteger(move.pp) && move.pp >= 0 && move.pp <= 63 && Number.isInteger(move.ppUps) && move.ppUps >= 0 && move.ppUps <= 3);
  return typeof e.rom === "string" && Number.isFinite(e.updatedAt) && games.includes(s.game) &&
    Number.isInteger(s.trainer.trainerId) && Number.isFinite(s.trainer.money) && s.trainer.playTime &&
    [s.trainer.playTime.hours, s.trainer.playTime.minutes, s.trainer.playTime.seconds].every(n => Number.isInteger(n) && n >= 0) && s.trainer.playTime.minutes < 60 && s.trainer.playTime.seconds < 60 &&
    Array.isArray(s.trainer.badges) && s.trainer.badges.length === (s.generation === 1 ? 8 : 16) && s.trainer.badges.every(b => typeof b === "boolean") &&
    numbers(s.pokedex.owned, max) && numbers(s.pokedex.seen, max) && s.pokedex.owned.every(n => s.pokedex.seen.includes(n)) &&
    Array.isArray(s.party) && s.party.length <= 6 && s.party.every(mon) &&
    Array.isArray(s.boxes.boxes) && s.boxes.boxes.every(b => b && typeof b.name === "string" && (b.pokemon === null || (Array.isArray(b.pokemon) && b.pokemon.every(mon)))) &&
    Array.isArray(e.events) && e.events.every(event => event && Number.isFinite(event.at) && ["start", "captured", "badge", "rewind"].includes(event.kind) && (event.value === undefined || Number.isInteger(event.value)));
}
export function reloadLegacyAdventures() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    entries = Array.isArray(value) ? value.filter(isLegacyAdventure).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch { entries = []; }
  notify();
}
reloadLegacyAdventures();

export function adventureEvents(previous: LegacySave | undefined, next: LegacySave, at: number): LegacyEvent[] {
  if (!previous || previous.game !== next.game || previous.playerName !== next.playerName || previous.trainer.trainerId !== next.trainer.trainerId) return [{ at, kind: "start" }];
  const seconds = (s: LegacySave) => s.trainer.playTime.hours * 3600 + s.trainer.playTime.minutes * 60 + s.trainer.playTime.seconds;
  if (seconds(next) < seconds(previous) || previous.pokedex.owned.some(n => !next.pokedex.owned.includes(n)) || previous.trainer.badges.some((b, i) => b && !next.trainer.badges[i])) return [{ at, kind: "rewind" }];
  return [
    ...next.pokedex.owned.filter(n => !previous.pokedex.owned.includes(n)).map(value => ({ at, kind: "captured" as const, value })),
    ...next.trainer.badges.flatMap((b, i) => b && !previous.trainer.badges[i] ? [{ at, kind: "badge" as const, value: i }] : []),
  ];
}
export function recordLegacyAdventure(rom: string, save: LegacySave, at = Date.now()) {
  const previous = entries.find(e => e.rom === rom);
  const events = [...(previous?.events ?? []), ...adventureEvents(previous?.save, save, at)].slice(-500);
  entries = [{ rom, save, updatedAt: at, events }, ...entries.filter(e => e.rom !== rom)];
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* Session data remains available if storage is full. */ }
  notify();
}
export function useLegacyAdventures() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => entries);
}
