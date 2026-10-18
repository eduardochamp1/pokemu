import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOENN_LAYOUT,
  HOENN_LINKS,
  MAP_MARKS_KEY,
  isMark,
  reloadMapMarks,
  setMapMarks,
  sortMarks,
  type MapMark,
} from "./mapMarks";
import { HOENN_TOWNS } from "../data/hoenn";
import { StaleWriteError } from "./recordStore";

const memory: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in memory ? memory[k] : null),
    setItem: (k: string, v: string) => {
      memory[k] = v;
    },
  } as unknown as Storage);
  reloadMapMarks();
});

const marca = (id: string, at: number, done = false): MapMark => ({ id, place: `Lugar ${id}`, note: "", at, done });

describe("marcações", () => {
  it("guarda por jogo, sem misturar", () => {
    setMapMarks("Emerald.gba", [marca("a", 1)]);
    setMapMarks("Red.gb", [marca("b", 2)]);
    const gravado = JSON.parse(memory[MAP_MARKS_KEY]);
    expect(gravado["Emerald.gba"].marks.map((m: MapMark) => m.id)).toEqual(["a"]);
    expect(gravado["Red.gb"].marks.map((m: MapMark) => m.id)).toEqual(["b"]);
  });

  it("recusa lugar em branco sem gravar", () => {
    expect(() => setMapMarks("a.gba", [{ ...marca("x", 1), place: "   " }])).toThrow();
    expect(memory[MAP_MARKS_KEY]).toBeUndefined();
  });

  it("marcação com forma errada é descartada ao regravar a aventura dela; as outras ficam como estão", () => {
    memory[MAP_MARKS_KEY] = JSON.stringify({ "a.gba": { rom: "a.gba", marks: [marca("ok", 1), { id: 5 }] } });
    reloadMapMarks();
    setMapMarks("b.gba", []);
    expect(JSON.parse(memory[MAP_MARKS_KEY])["a.gba"].marks).toHaveLength(2);
    setMapMarks("a.gba", [marca("ok", 1)]);
    expect(JSON.parse(memory[MAP_MARKS_KEY])["a.gba"].marks).toHaveLength(1);
  });

  it("isMark confere os limites", () => {
    expect(isMark(marca("a", 1))).toBe(true);
    expect(isMark({ ...marca("a", 1), note: "x".repeat(301) })).toBe(false);
    expect(isMark({ ...marca("a", 1), at: NaN })).toBe(false);
  });

  it("abertas primeiro, resolvidas no fim, na ordem em que foram marcadas", () => {
    expect(sortMarks([marca("c", 3), marca("feita", 1, true), marca("a", 2)]).map((m) => m.id)).toEqual(["a", "c", "feita"]);
  });
});

describe("esquema de Hoenn", () => {
  /** A ordem é a das flags do save: uma cidade a menos trocaria todas de lugar. */
  it("tem uma posição para cada cidade, na mesma ordem", () => {
    expect(HOENN_LAYOUT).toHaveLength(HOENN_TOWNS.length);
  });

  it("as posições cabem na grade e não se sobrepõem", () => {
    for (const p of HOENN_LAYOUT) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(60);
    }
    expect(new Set(HOENN_LAYOUT.map((p) => `${p.x},${p.y}`)).size).toBe(HOENN_LAYOUT.length);
  });

  it("toda cidade tem ao menos uma ligação, e as ligações apontam para cidades que existem", () => {
    const ligadas = new Set(HOENN_LINKS.flat());
    expect(ligadas.size).toBe(HOENN_TOWNS.length);
    for (const i of ligadas) expect(HOENN_LAYOUT[i]).toBeDefined();
  });
});

describe("outra aba (PS-02)", () => {
  it("gravação daqui não apaga a aventura que outra aba acrescentou", () => {
    setMapMarks("a.gba", [marca("a", 1)]);
    // Outra aba grava B depois da cópia em memória desta.
    const remoto = JSON.parse(memory[MAP_MARKS_KEY]);
    remoto["b.gba"] = { rom: "b.gba", marks: [marca("b", 2)] };
    memory[MAP_MARKS_KEY] = JSON.stringify(remoto);
    setMapMarks("a.gba", [marca("a", 1, true)]);
    const gravado = JSON.parse(memory[MAP_MARKS_KEY]);
    expect(gravado["b.gba"].marks.map((m: MapMark) => m.id)).toEqual(["b"]);
    expect(gravado["a.gba"].marks[0].done).toBe(true);
  });

  it("mesma aventura mudada em outra aba: recusa, recarrega e não perde a edição de lá", () => {
    setMapMarks("a.gba", [marca("a", 1)]);
    memory[MAP_MARKS_KEY] = JSON.stringify({ "a.gba": { rom: "a.gba", marks: [marca("a", 1), marca("outra-aba", 2)] } });
    expect(() => setMapMarks("a.gba", [])).toThrow(StaleWriteError);
    expect(JSON.parse(memory[MAP_MARKS_KEY])["a.gba"].marks).toHaveLength(2);
    // Já recarregada, a próxima tentativa parte do que a outra aba gravou.
    setMapMarks("a.gba", [marca("a", 1)]);
    expect(JSON.parse(memory[MAP_MARKS_KEY])["a.gba"].marks).toHaveLength(1);
  });
});
