import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHALLENGE_KEY,
  areaUsed,
  endChallenge,
  isChallenge,
  levelCapFor,
  overCap,
  reloadChallenges,
  startChallenge,
  updateChallenge,
  type Challenge,
} from "./challenge";
import { EMERALD_GYMS } from "../data/gymLeaders";
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
  reloadChallenges();
});

const gravado = () => JSON.parse(memory[CHALLENGE_KEY] ?? "{}") as Record<string, Challenge>;

describe("desafio por jogo", () => {
  it("começa com as duas regras clássicas e nada registrado", () => {
    startChallenge("Emerald.gba", 100);
    expect(gravado()["Emerald.gba"]).toEqual({
      rom: "Emerald.gba",
      startedAt: 100,
      rules: ["first-encounter", "faint-is-loss"],
      custom: [],
      encounters: [],
      losses: [],
    });
  });

  it("começar de novo não apaga o que já foi registrado", () => {
    startChallenge("Emerald.gba", 100);
    updateChallenge("Emerald.gba", { losses: [{ id: "1", name: "ZE", cause: "Roxanne", at: 5 }] });
    startChallenge("Emerald.gba", 999);
    expect(gravado()["Emerald.gba"].losses).toHaveLength(1);
    expect(gravado()["Emerald.gba"].startedAt).toBe(100);
  });

  it("um jogo não mexe no desafio do outro", () => {
    startChallenge("Emerald.gba", 1);
    startChallenge("Red.gb", 2);
    endChallenge("Emerald.gba");
    expect(Object.keys(gravado())).toEqual(["Red.gb"]);
  });

  it("recusa dado inválido sem gravar", () => {
    startChallenge("Emerald.gba", 1);
    expect(() => updateChallenge("Emerald.gba", { levelCap: 500 })).toThrow();
    expect(() => updateChallenge("Emerald.gba", { rules: ["regra-inventada"] })).toThrow();
    expect(gravado()["Emerald.gba"].levelCap).toBeUndefined();
  });

  it("falha de armazenamento sobe em vez de fingir que salvou", () => {
    startChallenge("Emerald.gba", 1);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => memory[k] ?? null,
      setItem: () => {
        throw new Error("cota");
      },
    } as unknown as Storage);
    expect(() => updateChallenge("Emerald.gba", { custom: ["Sem lendários"] })).toThrow("cota");
  });

  it("entrada com forma errada não é carregada, mas também não é apagada ao gravar outra", () => {
    memory[CHALLENGE_KEY] = JSON.stringify({
      "ok.gba": { rom: "ok.gba", startedAt: 1, rules: [], custom: [], encounters: [], losses: [] },
      "ruim.gba": { rom: "outro.gba", startedAt: 1, rules: [], custom: [], encounters: [], losses: [] },
    });
    reloadChallenges();
    startChallenge("novo.gba", 2);
    expect(Object.keys(gravado()).sort()).toEqual(["novo.gba", "ok.gba", "ruim.gba"]);
    expect(isChallenge(gravado()["ruim.gba"]) && gravado()["ruim.gba"].rom === "ruim.gba").toBe(false);
  });
});

describe("isChallenge", () => {
  const base: Challenge = { rom: "a.gba", startedAt: 1, rules: [], custom: [], encounters: [], losses: [] };

  it("área e nome em branco não valem", () => {
    expect(isChallenge({ ...base, encounters: [{ id: "1", area: "  ", outcome: "caught", at: 1 }] })).toBe(false);
    expect(isChallenge({ ...base, losses: [{ id: "1", name: "", cause: "", at: 1 }] })).toBe(false);
    expect(isChallenge({ ...base, encounters: [{ id: "1", area: "Route 101", outcome: "caught", at: 1 }] })).toBe(true);
  });
});

describe("limite de nível", () => {
  const insignias = (n: number) => Array.from({ length: 8 }, (_, i) => i < n);

  it("fixo vale o número; sem limite é null", () => {
    expect(levelCapFor(30, "emerald", insignias(0))).toBe(30);
    expect(levelCapFor(undefined, "emerald", insignias(0))).toBeNull();
  });

  it("pelo ginásio: o nível do pokémon mais forte do próximo líder", () => {
    const ace = Math.max(...EMERALD_GYMS[0].party.map((m) => m.level));
    expect(levelCapFor("gym", "emerald", insignias(0))).toBe(ace);
    expect(levelCapFor("gym", "emerald", insignias(8))).toBe(100);
  });

  /** Sem guia de ginásios não há de onde tirar o limite: não inventar um. */
  it("jogo sem guia ou sem save lido não tem limite automático", () => {
    expect(levelCapFor("gym", "rs", insignias(0))).toBeNull();
    expect(levelCapFor("gym", undefined, insignias(0))).toBeNull();
    expect(levelCapFor("gym", "emerald", undefined)).toBeNull();
  });

  it("aponta quem passou do limite", () => {
    const time = [{ nickname: "ZE", level: 16 }, { nickname: "ANA", level: 15 }];
    expect(overCap(time, 15)).toEqual([{ nickname: "ZE", level: 16 }]);
    expect(overCap(time, null)).toEqual([]);
  });
});

describe("areaUsed", () => {
  const e = [{ id: "1", area: "Rota 101", outcome: "caught" as const, at: 1 }];
  it("compara sem caixa, acento nem espaço nas pontas", () => {
    expect(areaUsed(e, " rota 101 ")).toBe(true);
    expect(areaUsed(e, "Rota 102")).toBe(false);
  });
});

describe("outra aba (PS-02)", () => {
  it("desafio desta aventura não apaga o que outra aba gravou em outra", () => {
    startChallenge("a.gba", 1);
    const remoto = gravado();
    remoto["b.gba"] = { ...remoto["a.gba"], rom: "b.gba" };
    memory[CHALLENGE_KEY] = JSON.stringify(remoto);
    updateChallenge("a.gba", { custom: ["sem cura"] });
    endChallenge("a.gba");
    expect(Object.keys(gravado())).toEqual(["b.gba"]);
  });

  it("mesmo desafio mudado em outra aba: recusa em vez de sobrescrever", () => {
    startChallenge("a.gba", 1);
    const remoto = gravado();
    remoto["a.gba"] = { ...remoto["a.gba"], custom: ["da outra aba"] };
    memory[CHALLENGE_KEY] = JSON.stringify(remoto);
    expect(() => updateChallenge("a.gba", { custom: ["daqui"] })).toThrow(StaleWriteError);
    expect(gravado()["a.gba"].custom).toEqual(["da outra aba"]);
    expect(() => endChallenge("a.gba")).not.toThrow();
  });
});
