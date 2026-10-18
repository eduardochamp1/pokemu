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
    FSSync: async () => undefined,
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

    expect(await registerLoadedRom(core, "Emerald.gba", ROM, 4, "folder", ["Emerald.gba"])).toEqual({ kind: "none" });
    const id = registro()["Emerald.gba"].adventureId;

    // No disco o arquivo virou Esmeralda.gba; o core acabou de receber a cópia nova.
    fs.set("/data/games/Esmeralda.gba", ROM);
    expect(await registerLoadedRom(core, "Esmeralda.gba", ROM, 4, "folder", ["Esmeralda.gba"])).toEqual({ kind: "renamed", from: "Emerald.gba" });

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
    expect(await registerLoadedRom(core, "b.gba", ROM, 4, "upload", null)).toEqual({ kind: "none" });
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
    expect(await registerLoadedRom(core, "a.gba", ROM, 4, "upload", null)).toEqual({ kind: "none" });
    expect(fs.has("/data/saves/a.sav")).toBe(true);
  });
});

describe("renomeação como migração (AUD-07)", () => {
  async function conhecida(extra: Record<string, Uint8Array> = {}) {
    const f = fakeCore({
      "/data/games/Emerald.gba": ROM,
      "/data/saves/Emerald.sav": new Uint8Array([9]),
      "/data/states/Emerald.ss1": new Uint8Array([8]),
      ...extra,
    });
    memory["pokedex:trainer-log"] = JSON.stringify({ "Emerald.gba": { rom: "Emerald.gba", n: 1 } });
    await registerLoadedRom(f.core, "Emerald.gba", ROM, 4, "folder", ["Emerald.gba"]);
    f.fs.set("/data/games/Novo.gba", ROM);
    return f;
  }

  it("nome novo que já tem save: bloqueia sem mover nada e o índice fica no nome antigo", async () => {
    const { core, fs } = await conhecida({ "/data/saves/Novo.sav": new Uint8Array([1]) });
    const r = await registerLoadedRom(core, "Novo.gba", ROM, 4, "folder", ["Novo.gba"]);
    expect(r).toEqual({ kind: "blocked", from: "Emerald.gba", reason: "conflict", items: ["/data/saves/Novo.sav"] });
    expect(fs.has("/data/saves/Emerald.sav")).toBe(true);
    expect(fs.has("/data/states/Emerald.ss1")).toBe(true);
    expect(Object.keys(registro())).toEqual(["Emerald.gba"]);
    expect(Object.keys(JSON.parse(memory["pokedex:trainer-log"]))).toEqual(["Emerald.gba"]);
  });

  it("falha ao gravar os registros desfaz os arquivos; tentar de novo conclui", async () => {
    const { core, fs } = await conhecida();
    const gravar = localStorage.setItem;
    let falhar = true;
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k in memory ? memory[k] : null),
      setItem: (k: string, v: string) => {
        if (falhar && k === "pokedex:trainer-log") throw new Error("cota");
        gravar(k, v);
      },
    } as unknown as Storage);
    const r = await registerLoadedRom(core, "Novo.gba", ROM, 4, "folder", ["Novo.gba"]);
    expect(r).toEqual({ kind: "blocked", from: "Emerald.gba", reason: "failed", items: ["data"] });
    expect(fs.has("/data/saves/Emerald.sav")).toBe(true);
    expect(fs.has("/data/saves/Novo.sav")).toBe(false);
    expect(Object.keys(registro())).toEqual(["Emerald.gba"]);

    falhar = false;
    expect(await registerLoadedRom(core, "Novo.gba", ROM, 4, "folder", ["Novo.gba"])).toEqual({ kind: "renamed", from: "Emerald.gba" });
    expect(fs.has("/data/saves/Novo.sav")).toBe(true);
    expect(Object.keys(registro())).toEqual(["Novo.gba"]);
  });

  it("interrompida depois de mover os registros: a próxima abertura termina sem duplicar", async () => {
    const { core, fs } = await conhecida();
    // Como ficaria depois de uma queda: os registros já no nome novo
    // (localStorage é imediato), os arquivos ainda no antigo (o FS não
    // sincronizou) e o índice no antigo.
    memory["pokedex:trainer-log"] = JSON.stringify({ "Novo.gba": { rom: "Novo.gba", n: 1 } });
    expect(await registerLoadedRom(core, "Novo.gba", ROM, 4, "folder", ["Novo.gba"])).toEqual({ kind: "renamed", from: "Emerald.gba" });
    expect([...fs.keys()].sort()).toEqual(["/data/games/Novo.gba", "/data/saves/Novo.sav", "/data/states/Novo.ss1"]);
    expect(JSON.parse(memory["pokedex:trainer-log"])).toEqual({ "Novo.gba": { rom: "Novo.gba", n: 1 } });
    // Abrir de novo não muda nada: migrar duas vezes dá o mesmo resultado.
    const antes = JSON.stringify(memory);
    expect(await registerLoadedRom(core, "Novo.gba", ROM, 4, "folder", ["Novo.gba"])).toEqual({ kind: "none" });
    expect(JSON.stringify(memory)).toBe(antes);
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
