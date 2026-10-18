import { beforeEach, describe, expect, it } from "vitest";
import {
  BRANCH_BYTES_PER_ROM,
  BranchBudgetError,
  branchFileName,
  branchesToPrune,
  branchSummary,
  deleteBranch,
  listBranches,
  newBranch,
  renameBranches,
  saveBranch,
} from "./branches";
import { resetMemoryStoresForTests } from "./idb";
import type { Capsule } from "./capsule";

beforeEach(resetMemoryStoresForTests);

const capsula = (data: Record<string, unknown> = {}, comSave = true): Capsule => ({
  app: "pokemu-capsule",
  version: 1,
  exportedAt: new Date(0).toISOString(),
  rom: { fileName: "Emerald.gba" },
  coreVersion: "c",
  files: comSave ? [{ kind: "save", suffix: ".sav", size: 1, sha256: "x", base64: "AQ==" }] : [],
  data,
});

describe("ramificações guardadas", () => {
  it("lista só as da ROM, da mais nova para a mais antiga", async () => {
    await saveBranch(newBranch("Emerald.gba", "Time de água", capsula(), false, 100, "a"));
    await saveBranch(newBranch("Emerald.gba", "Time de fogo", capsula(), false, 200, "b"));
    await saveBranch(newBranch("Red.gb", "Outra", capsula(), false, 300, "c"));
    expect((await listBranches("Emerald.gba")).map((b) => b.name)).toEqual(["Time de fogo", "Time de água"]);
  });

  it("apagar tira só aquela", async () => {
    await saveBranch(newBranch("Emerald.gba", "A", capsula(), false, 1, "a"));
    await saveBranch(newBranch("Emerald.gba", "B", capsula(), false, 2, "b"));
    await deleteBranch("a");
    expect((await listBranches("Emerald.gba")).map((b) => b.id)).toEqual(["b"]);
  });

  it("renomear a ROM leva as ramificações junto", async () => {
    await saveBranch(newBranch("Emerald.gba", "A", capsula(), false, 1, "a"));
    await renameBranches("Emerald.gba", "Esmeralda.gba");
    expect(await listBranches("Emerald.gba")).toEqual([]);
    expect((await listBranches("Esmeralda.gba")).map((b) => b.id)).toEqual(["a"]);
  });

  it("nome em branco ganha um nome padrão, e nome longo é cortado", () => {
    expect(newBranch("a.gba", "   ", capsula()).name).toBe("Ramificação");
    expect(newBranch("a.gba", "x".repeat(200), capsula()).name).toHaveLength(60);
  });
});

describe("branchSummary", () => {
  it("lê a ficha de Gen 3", () => {
    const s = branchSummary(
      capsula({
        "pokedex:trainer-log": {
          trainer: { playTime: { hours: 2, minutes: 30, seconds: 15 }, badges: [true, true, false] },
          owned: [1, 2, 3, 4],
          team: [{ nickname: "ZE", level: 22 }, { nickname: "ANA", level: 19 }],
        },
      })
    );
    expect(s).toEqual({
      playSeconds: 9015,
      badges: 2,
      owned: 4,
      team: [{ name: "ZE", level: 22 }, { name: "ANA", level: 19 }],
      hasSave: true,
    });
  });

  it("lê a ficha de Gen 1/2", () => {
    const s = branchSummary(
      capsula({
        "pokedex:legacy-adventures": {
          save: {
            trainer: { playTime: { hours: 1, minutes: 0, seconds: 0 }, badges: [true, false] },
            pokedex: { owned: [1, 4] },
            party: [{ nickname: "PIKA", level: null }],
          },
        },
      })
    );
    expect(s).toMatchObject({ playSeconds: 3600, badges: 1, owned: 2, team: [{ name: "PIKA", level: null }] });
  });

  /** Sem ficha, o resumo fica em branco: zero insígnias seria uma afirmação falsa. */
  it("sem ficha não inventa números", () => {
    expect(branchSummary(capsula({}, false))).toEqual({ team: [], hasSave: false });
  });

  it("ficha com forma inesperada não lança", () => {
    expect(() => branchSummary(capsula({ "pokedex:trainer-log": { trainer: "x", team: [null, 5] } }))).not.toThrow();
  });
});

describe("política de espaço (AUD-15)", () => {
  const pesada = (bytes: number): Capsule => ({ ...capsula(), guide: "x".repeat(bytes) });

  it("100 trocas: ficam as 5 automáticas mais novas, e as manuais intactas", async () => {
    await saveBranch(newBranch("a.gba", "Minha", capsula(), false, 1, "manual"));
    for (let i = 0; i < 100; i++) await saveBranch(newBranch("a.gba", `auto ${i}`, capsula(), true, 10 + i, `auto-${i}`));
    const lista = await listBranches("a.gba");
    expect(lista.filter((b) => b.automatic).map((b) => b.name)).toEqual(["auto 99", "auto 98", "auto 97", "auto 96", "auto 95"]);
    expect(lista.filter((b) => !b.automatic).map((b) => b.id)).toEqual(["manual"]);
  });

  it("passando do orçamento, saem as automáticas mais antigas — nunca a recém-guardada", () => {
    const grande = Math.floor(BRANCH_BYTES_PER_ROM / 3.5);
    const lista = [
      newBranch("a.gba", "m", pesada(grande), false, 1, "m"),
      newBranch("a.gba", "a1", pesada(grande), true, 2, "a1"),
      newBranch("a.gba", "a2", pesada(grande), true, 3, "a2"),
      newBranch("a.gba", "nova", pesada(grande), true, 4, "nova"),
    ];
    expect(branchesToPrune(lista, "nova").map((b) => b.id)).toEqual(["a1"]);
  });

  it("manual que não cabe é recusada antes de gravar, e nada some", async () => {
    await saveBranch(newBranch("a.gba", "m1", pesada(BRANCH_BYTES_PER_ROM * 0.6), false, 1, "m1"));
    await expect(saveBranch(newBranch("a.gba", "m2", pesada(BRANCH_BYTES_PER_ROM * 0.6), false, 2, "m2"))).rejects.toBeInstanceOf(
      BranchBudgetError
    );
    expect((await listBranches("a.gba")).map((b) => b.id)).toEqual(["m1"]);
  });

  it("outro jogo não entra na conta", async () => {
    for (let i = 0; i < 8; i++) await saveBranch(newBranch("b.gba", `b ${i}`, capsula(), true, i, `b-${i}`));
    await saveBranch(newBranch("a.gba", "a", capsula(), true, 100, "a"));
    expect(await listBranches("a.gba")).toHaveLength(1);
    expect(await listBranches("b.gba")).toHaveLength(5);
  });

  it("nome do arquivo exportado leva jogo, nome e data, sem caractere proibido", () => {
    expect(branchFileName({ rom: "Emerald.gba", name: "Antes/da: Elite", createdAt: new Date(2026, 9, 12).getTime() })).toBe(
      "Emerald - Antes-da- Elite - 2026-10-12.pokemu.json"
    );
  });
});
