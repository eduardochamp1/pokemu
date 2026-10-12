import { describe, expect, it, beforeEach, vi } from "vitest";
import { recordPlayerDex, reloadPlayerDex, type PlayerDexEntry } from "./playerDex";

const KEY = "pokedex:player-dex";

// Stub minimo pra localStorage no ambiente node.
const memory: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in memory ? memory[k] : null),
    setItem: (k: string, v: string) => {
      memory[k] = v;
    },
    removeItem: (k: string) => {
      delete memory[k];
    },
  } as unknown as Storage);
  reloadPlayerDex();
});

/** O que ficou gravado: é o que o backup de "Seus dados" leva. */
const gravado = (): Record<string, PlayerDexEntry> => JSON.parse(memory[KEY] ?? "{}");

const EMERALD = { seen: [252, 258, 261, 263, 265, 278], owned: [258] };

describe("playerDex — store", () => {
  it("grava a entrada da ROM", () => {
    recordPlayerDex("Pokemon - Emerald.gba", "ZE", EMERALD, 1000);
    expect(gravado()).toEqual({
      "Pokemon - Emerald.gba": {
        rom: "Pokemon - Emerald.gba",
        playerName: "ZE",
        seen: EMERALD.seen,
        owned: EMERALD.owned,
        updatedAt: 1000,
      },
    });
  });

  it("guarda uma entrada por jogo", () => {
    recordPlayerDex("Emerald.gba", "ZE", EMERALD, 1000);
    recordPlayerDex("Ruby.gba", "ANA", { seen: [1], owned: [1] }, 2000);
    expect(Object.keys(gravado()).sort()).toEqual(["Emerald.gba", "Ruby.gba"]);
  });

  it("recarregar não perde o que outro jogo gravou", () => {
    recordPlayerDex("Emerald.gba", "ZE", EMERALD, 1000);
    reloadPlayerDex();
    recordPlayerDex("Ruby.gba", "ANA", { seen: [1], owned: [1] }, 2000);
    expect(gravado()["Emerald.gba"].owned).toEqual([258]);
  });

  it("regravar a mesma ROM substitui, não acumula", () => {
    recordPlayerDex("Emerald.gba", "ZE", EMERALD, 1000);
    recordPlayerDex("Emerald.gba", "ZE", { seen: [1, 258], owned: [1, 258] }, 2000);
    expect(gravado()["Emerald.gba"].seen).toEqual([1, 258]);
    expect(Object.keys(gravado())).toEqual(["Emerald.gba"]);
  });

  it("descarta o que foi gravado com forma errada", () => {
    memory[KEY] = JSON.stringify({
      "a.gba": { rom: "a.gba", playerName: "X", seen: "nada", owned: [], updatedAt: 5 },
      "b.gba": { rom: "b.gba", playerName: "Y", seen: [2], owned: [2], updatedAt: 1 },
    });
    reloadPlayerDex();
    recordPlayerDex("c.gba", "Z", { seen: [3], owned: [3] }, 9);
    expect(Object.keys(gravado()).sort()).toEqual(["b.gba", "c.gba"]);
  });

  it("JSON quebrado vira store vazio, não exceção", () => {
    memory[KEY] = "{isso não é json";
    reloadPlayerDex();
    recordPlayerDex("Emerald.gba", "ZE", EMERALD, 1000);
    expect(Object.keys(gravado())).toEqual(["Emerald.gba"]);
  });

  it("sem localStorage gravar não lança", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    } as unknown as Storage);
    reloadPlayerDex();
    expect(() => recordPlayerDex("Emerald.gba", "ZE", EMERALD, 1000)).not.toThrow();
  });
});
