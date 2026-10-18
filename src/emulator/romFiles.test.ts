import { describe, expect, it } from "vitest";

const DIRS = { savePath: "/data/saves", saveStatePath: "/data/states", screenshotsPath: "/data/screenshots" };
import { applyRomFileRename, planRomFileRename, type FsLike } from "./romFiles";
import { RollbackError } from "../lib/capsule";

/** O jeito antigo de usar: planejar e aplicar, devolvendo o que mudou. */
function renameRomFiles(fs: FsLike, dirs: typeof DIRS, from: string, to: string): [string, string][] {
  const plano = planRomFileRename(fs, dirs, from, to);
  if (plano.conflicts.length > 0) return [];
  applyRomFileRename(fs, plano.moves);
  return plano.moves;
}


/** FS falso: um conjunto de caminhos completos. */
function fakeFs(paths: string[]): FsLike & { paths: Set<string> } {
  const set = new Set(paths);
  return {
    paths: set,
    readdir(dir) {
      const nomes = [...set].filter((p) => p.startsWith(dir + "/")).map((p) => p.slice(dir.length + 1));
      if (nomes.length === 0 && !["/data/saves", "/data/states", "/data/screenshots"].includes(dir)) {
        throw new Error("ENOENT");
      }
      return [".", "..", ...nomes];
    },
    rename(from, to) {
      if (!set.has(from)) throw new Error("ENOENT");
      set.delete(from);
      set.add(to);
    },
  };
}

describe("renameRomFiles", () => {
  it("leva save, pontos de retorno, miniaturas e capturas", () => {
    const fs = fakeFs([
      "/data/saves/Emerald.sav",
      "/data/states/Emerald.ss1",
      "/data/states/Emerald_auto.ss",
      "/data/screenshots/Emerald.ss1.png",
      "/data/screenshots/Emerald-20261012-101500.png",
    ]);
    expect(renameRomFiles(fs, DIRS, "Emerald.gba", "Esmeralda.gba")).toHaveLength(5);
    expect([...fs.paths].sort()).toEqual([
      "/data/saves/Esmeralda.sav",
      "/data/screenshots/Esmeralda-20261012-101500.png",
      "/data/screenshots/Esmeralda.ss1.png",
      "/data/states/Esmeralda.ss1",
      "/data/states/Esmeralda_auto.ss",
    ]);
  });

  /** `Emerald (2)` começa com `Emerald` e é outro jogo da biblioteca. */
  it("não toca em arquivo de outra ROM que começa com o mesmo nome", () => {
    const fs = fakeFs(["/data/saves/Emerald.sav", "/data/saves/Emerald (2).sav", "/data/saves/Emerald-hack.sav"]);
    renameRomFiles(fs, DIRS, "Emerald.gba", "Novo.gba");
    expect([...fs.paths].sort()).toEqual([
      "/data/saves/Emerald (2).sav",
      "/data/saves/Emerald-hack.sav",
      "/data/saves/Novo.sav",
    ]);
  });

  it("save que já existe com o nome novo é conflito e nada se move (AUD-07)", () => {
    const fs = fakeFs(["/data/saves/Emerald.sav", "/data/states/Emerald.ss1", "/data/saves/Novo.sav"]);
    expect(planRomFileRename(fs, DIRS, "Emerald.gba", "Novo.gba").conflicts).toEqual(["/data/saves/Novo.sav"]);
    expect(renameRomFiles(fs, DIRS, "Emerald.gba", "Novo.gba")).toEqual([]);
    expect(fs.paths.has("/data/saves/Emerald.sav")).toBe(true);
    expect(fs.paths.has("/data/states/Emerald.ss1")).toBe(true);
  });

  it("um arquivo que não renomeia faz os outros voltarem (AUD-07)", () => {
    const fs = fakeFs(["/data/saves/Emerald.sav", "/data/states/Emerald.ss1"]);
    const renomear = fs.rename;
    fs.rename = (a, b) => {
      if (a.endsWith(".ss1")) throw new Error("travado");
      renomear(a, b);
    };
    const plano = planRomFileRename(fs, DIRS, "Emerald.gba", "Novo.gba");
    expect(() => applyRomFileRename(fs, plano.moves)).toThrow("travado");
    expect([...fs.paths].sort()).toEqual(["/data/saves/Emerald.sav", "/data/states/Emerald.ss1"]);
  });

  it("se nem voltar der, avisa com RollbackError", () => {
    const fs = fakeFs(["/data/saves/Emerald.sav", "/data/states/Emerald.ss1"]);
    const renomear = fs.rename;
    fs.rename = (a, b) => {
      if (a.endsWith(".ss1") || a.endsWith("Novo.sav")) throw new Error("travado");
      renomear(a, b);
    };
    expect(() => applyRomFileRename(fs, planRomFileRename(fs, DIRS, "Emerald.gba", "Novo.gba").moves)).toThrow(RollbackError);
  });

  it("nome com caracteres de regex é tratado como texto", () => {
    const fs = fakeFs(["/data/saves/Unbound (v2.1.1.1).sav", "/data/saves/Unbound (v2x1y1z1).sav"]);
    renameRomFiles(fs, DIRS, "Unbound (v2.1.1.1).gba", "Unbound.gba");
    expect([...fs.paths].sort()).toEqual(["/data/saves/Unbound (v2x1y1z1).sav", "/data/saves/Unbound.sav"]);
  });

  it("só a extensão mudou: não há o que renomear", () => {
    const fs = fakeFs(["/data/saves/jogo.sav"]);
    expect(renameRomFiles(fs, DIRS, "jogo.gb", "jogo.gbc")).toEqual([]);
  });

  it("diretório inexistente não lança", () => {
    const fs = fakeFs([]);
    expect(() =>
      renameRomFiles(fs, { savePath: "/x", saveStatePath: "/y", screenshotsPath: "/z" }, "a.gba", "b.gba")
    ).not.toThrow();
  });
});
