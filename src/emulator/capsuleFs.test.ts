import { describe, expect, it } from "vitest";
import { collectRomFiles, existingSuffixes, writeRestore, type CapsuleFs } from "./capsuleFs";
import { capsuleFile, planRestore, type Capsule } from "../lib/capsule";

const DIRS = { savePath: "/data/saves", saveStatePath: "/data/states", screenshotsPath: "/data/screenshots" };

function fakeFs(files: Record<string, number[]>, failOnWrite?: string): CapsuleFs & { files: Map<string, Uint8Array> } {
  const map = new Map(Object.entries(files).map(([k, v]) => [k, new Uint8Array(v)]));
  return {
    files: map,
    readdir: (dir) => [".", "..", ...[...map.keys()].filter((p) => p.startsWith(dir + "/")).map((p) => p.slice(dir.length + 1))],
    readFile: (p) => {
      const b = map.get(p);
      if (!b) throw new Error("ENOENT");
      return b;
    },
    writeFile: (p, data) => {
      if (p === failOnWrite) throw new Error("cota");
      map.set(p, new Uint8Array(data));
    },
    rename: (a, b) => {
      const v = map.get(a);
      if (!v) throw new Error("ENOENT");
      map.delete(a);
      map.set(b, v);
    },
    unlink: (p) => {
      if (!map.delete(p)) throw new Error("ENOENT");
    },
  };
}

const estado = (fs: { files: Map<string, Uint8Array> }) =>
  Object.fromEntries([...fs.files].sort().map(([k, v]) => [k, [...v]]));

describe("collectRomFiles", () => {
  it("junta save, pontos de retorno, miniaturas e capturas só desta ROM", async () => {
    const fs = fakeFs({
      "/data/saves/Emerald.sav": [1],
      "/data/saves/Emerald (2).sav": [9],
      "/data/states/Emerald.ss1": [2],
      "/data/states/Emerald_auto.ss": [3],
      "/data/screenshots/Emerald.ss1.png": [4],
      "/data/screenshots/Emerald-20261012-101500.png": [5],
      "/data/screenshots/Emerald-hack-20261012-101500.png": [9],
    });
    const files = await collectRomFiles(fs, DIRS, "Emerald.gba");
    expect(files.map((f) => [f.kind, f.suffix]).sort()).toEqual([
      ["save", ".sav"],
      ["screenshot", "-20261012-101500.png"],
      ["state", ".ss1"],
      ["state", "_auto.ss"],
      ["thumbnail", ".ss1.png"],
    ]);
    expect(existingSuffixes(fs, DIRS, "Emerald.gba").size).toBe(5);
  });
});

async function capsula(): Promise<Capsule> {
  return {
    app: "pokemu-capsule",
    version: 1,
    exportedAt: new Date(0).toISOString(),
    rom: { fileName: "Emerald.gba" },
    coreVersion: "c",
    files: [
      await capsuleFile("save", ".sav", new Uint8Array([7, 7])),
      await capsuleFile("state", ".ss1", new Uint8Array([8])),
    ],
    data: {},
  };
}

describe("writeRestore", () => {
  it("grava sob o nome daqui e substitui o que existia", async () => {
    const fs = fakeFs({ "/data/saves/Local.sav": [1], "/data/saves/Outro.sav": [5] });
    const plano = planRestore(await capsula(), existingSuffixes(fs, DIRS, "Local.gba"), "c");
    expect(writeRestore(fs, DIRS, "Local.gba", plano)).toBe(2);
    expect(estado(fs)).toEqual({
      "/data/saves/Local.sav": [7, 7],
      "/data/saves/Outro.sav": [5],
      "/data/states/Local.ss1": [8],
    });
  });

  /** O save bom não pode ser a vítima de uma restauração que não coube. */
  it("falha no meio devolve o save que estava lá e não deixa resto", async () => {
    const fs = fakeFs({ "/data/saves/Local.sav": [1] }, "/data/states/Local.ss1");
    const plano = planRestore(await capsula(), existingSuffixes(fs, DIRS, "Local.gba"), "c");
    expect(() => writeRestore(fs, DIRS, "Local.gba", plano)).toThrow("cota");
    expect(estado(fs)).toEqual({ "/data/saves/Local.sav": [1] });
  });

  it("ponto de retorno de outro core não é gravado", async () => {
    const fs = fakeFs({});
    const plano = planRestore(await capsula(), new Set(), "outro");
    writeRestore(fs, DIRS, "Local.gba", plano);
    expect(estado(fs)).toEqual({ "/data/saves/Local.sav": [7, 7] });
  });
});

describe("writeRestore exato (troca de ramificação)", () => {
  /** Um ponto de retorno da outra linha do tempo não pode sobrar. */
  it("tira o que a ROM tem e a cápsula não traz", async () => {
    const fs = fakeFs({
      "/data/saves/Local.sav": [1],
      "/data/states/Local.ss3": [3],
      "/data/screenshots/Local.ss3.png": [4],
      "/data/saves/Outro.sav": [5],
    });
    const plano = planRestore(await capsula(), existingSuffixes(fs, DIRS, "Local.gba"), "c");
    writeRestore(fs, DIRS, "Local.gba", plano, true);
    expect(estado(fs)).toEqual({
      "/data/saves/Local.sav": [7, 7],
      "/data/saves/Outro.sav": [5],
      "/data/states/Local.ss1": [8],
    });
  });

  it("falha no meio devolve também o que tinha sido tirado", async () => {
    const fs = fakeFs({ "/data/saves/Local.sav": [1], "/data/states/Local.ss3": [3] }, "/data/states/Local.ss1");
    const plano = planRestore(await capsula(), existingSuffixes(fs, DIRS, "Local.gba"), "c");
    expect(() => writeRestore(fs, DIRS, "Local.gba", plano, true)).toThrow("cota");
    expect(estado(fs)).toEqual({ "/data/saves/Local.sav": [1], "/data/states/Local.ss3": [3] });
  });
});
