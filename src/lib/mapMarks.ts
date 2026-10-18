import { useSyncExternalStore } from "react";
import { onOtherTab, StaleWriteError, writeRecordEntry } from "./recordStore";

/**
 * Mapa de progresso: os lugares que a pessoa marca numa aventura.
 *
 * O site não sabe onde o jogador está — o save de Emerald diz quais cidades
 * já foram visitadas, e é só. O resto do mapa é anotação de quem joga: "voltar
 * aqui com Surf", "tem um item atrás da pedra". Por isso é uma lista de
 * marcações com lugar e nota, e não um GPS.
 */

export interface MapMark {
  id: string;
  place: string;
  note: string;
  at: number;
  done?: boolean;
}

export const MAP_MARKS_KEY = "pokedex:map-marks";
export const MAX_MARKS = 200;

interface Entry {
  rom: string;
  marks: MapMark[];
}

const texto = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

export function isMark(v: unknown): v is MapMark {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return (
    texto(m.id, 60) &&
    texto(m.place, 80) &&
    (m.place as string).trim().length > 0 &&
    texto(m.note, 300) &&
    typeof m.at === "number" &&
    Number.isFinite(m.at) &&
    (m.done === undefined || typeof m.done === "boolean")
  );
}

let entries: Record<string, Entry> = {};
const listeners = new Set<() => void>();
const VAZIO: MapMark[] = [];

/** A entrada como este store a lê: só as marcações válidas. */
const entryDe = (rom: string) => (e: unknown): Entry | undefined => {
  const marks = (e as { marks?: unknown } | null)?.marks;
  return Array.isArray(marks) ? { rom, marks: marks.filter(isMark).slice(0, MAX_MARKS) } : undefined;
};

export function reloadMapMarks(): void {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MAP_MARKS_KEY) ?? "{}");
    const out: Record<string, Entry> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [rom, e] of Object.entries(parsed)) {
        const entry = entryDe(rom)(e);
        if (entry) out[rom] = entry;
      }
    }
    entries = out;
  } catch {
    entries = {};
  }
  listeners.forEach((l) => l());
}
reloadMapMarks();

/**
 * Grava e só então publica: falha de armazenamento não finge ter salvado.
 * Só a entrada desta ROM é trocada, relida na hora; se outra aba mudou estas
 * mesmas marcações, sobe `StaleWriteError` e a lista é recarregada.
 */
export function setMapMarks(rom: string, marks: MapMark[]): void {
  if (marks.length > MAX_MARKS || !marks.every(isMark)) throw new Error("Invalid map marks");
  try {
    writeRecordEntry(MAP_MARKS_KEY, rom, entries[rom], { rom, marks }, entryDe(rom));
  } catch (error) {
    if (error instanceof StaleWriteError) reloadMapMarks();
    throw error;
  }
  reloadMapMarks();
}

let pararDeOuvir: (() => void) | null = null;

function subscribe(l: () => void) {
  if (listeners.size === 0) pararDeOuvir = onOtherTab(MAP_MARKS_KEY, reloadMapMarks);
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      pararDeOuvir?.();
      pararDeOuvir = null;
    }
  };
}

export function useMapMarks(rom: string): MapMark[] {
  return useSyncExternalStore(
    subscribe,
    () => entries[rom]?.marks ?? VAZIO,
    () => VAZIO
  );
}

/** Abertas primeiro, na ordem em que foram marcadas; as resolvidas no fim. */
export function sortMarks(marks: readonly MapMark[]): MapMark[] {
  return [...marks].sort((a, b) => Number(a.done === true) - Number(b.done === true) || a.at - b.at);
}

/**
 * Hoenn em esquema: a posição relativa das dezesseis cidades e as ligações
 * entre elas, numa grade de 100 × 60. Desenho próprio e fora de escala — serve
 * para ver o que falta visitar, não para se orientar em rota.
 *
 * A ordem é a de `HOENN_TOWNS`, que é a ordem das flags no save.
 */
export const HOENN_LAYOUT: { x: number; y: number }[] = [
  { x: 22, y: 51 }, // Littleroot
  { x: 22, y: 41 }, // Oldale
  { x: 11, y: 56 }, // Dewford
  { x: 27, y: 15 }, // Lavaridge
  { x: 17, y: 6 }, // Fallarbor
  { x: 24, y: 28 }, // Verdanturf
  { x: 64, y: 51 }, // Pacifidlog
  { x: 11, y: 39 }, // Petalburg
  { x: 37, y: 47 }, // Slateport
  { x: 37, y: 28 }, // Mauville
  { x: 9, y: 22 }, // Rustboro
  { x: 56, y: 8 }, // Fortree
  { x: 70, y: 18 }, // Lilycove
  { x: 86, y: 20 }, // Mossdeep
  { x: 78, y: 34 }, // Sootopolis
  { x: 95, y: 41 }, // Ever Grande
];

/** Pares de índices de cidades ligadas por terra ou mar. */
export const HOENN_LINKS: [number, number][] = [
  [0, 1], [1, 7], [7, 10], [1, 8], [8, 9], [9, 5], [5, 10], [9, 3], [3, 4], [4, 10],
  [9, 11], [11, 12], [12, 13], [13, 14], [14, 15], [8, 6], [6, 14], [7, 2], [2, 8],
];
