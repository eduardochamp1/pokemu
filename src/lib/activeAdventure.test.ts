import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adventureLabel,
  getActiveAdventure,
  pickAdventure,
  reloadActiveAdventure,
  setActiveAdventure,
} from "./activeAdventure";

const memory: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in memory ? memory[k] : null),
    setItem: (k: string, v: string) => {
      memory[k] = v;
    },
  } as unknown as Storage);
  reloadActiveAdventure();
});

describe("aventura ativa", () => {
  it("começa sem nenhuma", () => {
    expect(getActiveAdventure()).toBeUndefined();
  });

  it("guarda a escolha e a devolve depois de recarregar", () => {
    setActiveAdventure("Emerald.gba");
    reloadActiveAdventure();
    expect(getActiveAdventure()).toBe("Emerald.gba");
  });

  it("sem localStorage a escolha vale na sessão", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    } as unknown as Storage);
    reloadActiveAdventure();
    setActiveAdventure("Red.gb");
    expect(getActiveAdventure()).toBe("Red.gb");
  });
});

describe("pickAdventure", () => {
  const lista = [{ rom: "Emerald.gba" }, { rom: "LeafGreen.gba" }];

  it("usa a ativa quando a página a aceita", () => {
    expect(pickAdventure(lista, "LeafGreen.gba")).toEqual({ entry: lista[1], matched: true });
  });

  /** Ginásios aberto com um jogo de Gen 1 ativo: mostra outro, e diz que mostrou. */
  it("recua para a primeira e avisa quando a ativa não serve", () => {
    expect(pickAdventure(lista, "Red.gb")).toEqual({ entry: lista[0], matched: false });
  });

  it("sem ativa, a primeira não é um recuo", () => {
    expect(pickAdventure(lista, undefined)).toEqual({ entry: lista[0], matched: true });
  });

  it("lista vazia não tem o que escolher", () => {
    expect(pickAdventure([], "Red.gb")).toEqual({ entry: undefined, matched: false });
  });
});

describe("adventureLabel", () => {
  it("tira só a extensão", () => {
    expect(adventureLabel("Pokemon Unbound (v2.1.1.1).gba")).toBe("Pokemon Unbound (v2.1.1.1)");
  });
});
