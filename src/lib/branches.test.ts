import { beforeEach, describe, expect, it } from "vitest";
import {
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
