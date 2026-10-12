import { beforeEach, describe, expect, it, vi } from "vitest";
import { backfillIdentities, registerLoadedRom } from "./romRegistration";
import { ROM_IDENTITY_KEY } from "../lib/romIdentity";
import type { mGBAEmulator } from "./types";

const memory: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(memory)) delete memory[k];
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in memory ? memory[k] : null),
    setItem: (k: string, v: string) => {
      memory[k] = v;
    },
  } as unknown as Storage);
});

const PATHS = {
  gamePath: "/data/games",
  savePath: "/data/saves",
  saveStatePath: "/data/states",
  screenshotsPath: "/data/screenshots",
};

/** Core falso: um mapa de caminho -> bytes. */
function fakeCore(files: Record<string, Uint8Array>) {
  const fs = new Map(Object.entries(files));
  const dir = (d: string) => [...fs.keys()].filter((p) => p.startsWith(d + "/")).map((p) => p.slice(d.length + 1));
  const core = {
    filePaths: () => PATHS,
    listRoms: () => dir(PATHS.gamePath),
    FS: {
      readdir: (d: string) => [".", "..", ...dir(d)],
      readFile: (p: string) => {
        const b = fs.get(p);
        if (!b) throw new Error("ENOENT");
        return b;
      },
      rename: (a: string, b: string) => {
        const v = fs.get(a);
        if (!v) throw new Error("ENOENT");
        fs.delete(a);
        fs.set(b, v);
      },
      unlink: (p: string) => {
        if (!fs.delete(p)) throw new Error("ENOENT");
      },
    },
  } as unknown as mGBAEmulator;
  return { core, fs };
}

const ROM = new Uint8Array([1, 2, 3, 4]);
const registro = () => JSON.parse(memory[ROM_IDENTITY_KEY] ?? "{}") as Record<string, { adventureId: string; source?: string }>;

describe("registerLoadedRom", () => {
  it("ROM da pasta renomeada no disco leva save, diário e a cópia antiga some", async () => {
    const { core, fs } = fakeCore({
      "/data/games/Emerald.gba": ROM,
      "/data/saves/Emerald.sav": new Uint8Array([9]),
      "/data/states/Emerald.ss1": new Uint8Array([8]),
    });
    memory["pokedex:personal-adventures"] = JSON.stringify([{ rom: "Emerald.gba", favorite: true }]);

    expect(await registerLoadedRom(core, "Emerald.gba", ROM, 4, "folder", ["Emerald.gba"])).toBeUndefined();
    const id = registro()["Emerald.gba"].adventureId;

    // No disco o arquivo virou Esmeralda.gba; o core acabou de receber a cópia nova.
    fs.set("/data/games/Esmeralda.gba", ROM);
    expect(await registerLoadedRom(core, "Esmeralda.gba", ROM, 4, "folder", ["Esmeralda.gba"])).toBe("Emerald.gba");

    expect([...fs.keys()].sort()).toEqual([
      "/data/games/Esmeralda.gba",
      "/data/saves/Esmeralda.sav",
      "/data/states/Esmeralda.ss1",
    ]);
    expect(registro()).toEqual({ "Esmeralda.gba": expect.objectContaining({ adventureId: id, source: "folder" }) });
    expect(JSON.parse(memory["pokedex:personal-adventures"])[0].rom).toBe("Esmeralda.gba");
  });

  /** Sem pasta, a cópia no navegador é o próprio arquivo: os dois existem. */
  it("pelo seletor, o mesmo arquivo com outro nome é uma cópia com aventura própria", async () => {
    const { core, fs } = fakeCore({ "/data/games/a.gba": ROM, "/data/saves/a.sav": new Uint8Array([9]) });
    await registerLoadedRom(core, "a.gba", ROM, 4, "upload", null);
    fs.set("/data/games/b.gba", ROM);
    expect(await registerLoadedRom(core, "b.gba", ROM, 4, "upload", null)).toBeUndefined();
    expect(fs.has("/data/saves/a.sav")).toBe(true);
    expect(registro()["a.gba"].adventureId).not.toBe(registro()["b.gba"].adventureId);
  });

  it("sem localStorage não lança e não renomeia nada", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    } as unknown as Storage);
    const { core, fs } = fakeCore({ "/data/games/a.gba": ROM, "/data/saves/a.sav": new Uint8Array([9]) });
    expect(await registerLoadedRom(core, "a.gba", ROM, 4, "upload", null)).toBeUndefined();
    expect(fs.has("/data/saves/a.sav")).toBe(true);
  });
});

describe("backfillIdentities", () => {
  it("registra o que já estava na biblioteca, com a origem certa, sem tratar nada como renomeação", async () => {
    const { core } = fakeCore({
      "/data/games/pasta.gba": ROM,
      "/data/games/copia.gba": ROM,
      "/data/games/leia-me.txt": new Uint8Array([0]),
    });
    await backfillIdentities(core, ["gba/pasta.gba"]);
    const r = registro();
    expect(Object.keys(r).sort()).toEqual(["copia.gba", "pasta.gba"]);
    expect(r["pasta.gba"].source).toBe("folder");
    expect(r["copia.gba"].source).toBe("upload");
    expect(r["pasta.gba"].adventureId).not.toBe(r["copia.gba"].adventureId);
  });
});
