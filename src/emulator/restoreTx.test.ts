// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recoverPendingRestore, resetRestoreLockForTests, runRestore, RestoreError, type RestoreMode } from "./restoreTx";
import { capsuleFile, planRestore, type Capsule } from "../lib/capsule";
import * as guideStore from "../lib/guideStore";
import { readGuideText, resetGuideStoreForTests, writeGuideText } from "../lib/guideStore";

const DIRS = { savePath: "/saves", saveStatePath: "/states", screenshotsPath: "/photos" };
const ROM = "demo.gba";

/**
 * Um core falso com FS em memória e o "disco": o que a última FSSync gravou.
 * Reabrir depois de uma queda é começar de novo a partir do disco.
 */
function fakeCore(inicial: Record<string, number[]>) {
  const files = new Map(Object.entries(inicial).map(([k, v]) => [k, new Uint8Array(v)]));
  let disco = new Map(files);
  const falhar: { write?: string; sync?: number } = {};
  let syncs = 0;
  const FS = {
    readdir: (dir: string) => [...files.keys()].filter((p) => p.startsWith(dir + "/")).map((p) => p.slice(dir.length + 1)),
    readFile: (p: string) => {
      const b = files.get(p);
      if (!b) throw new Error("missing");
      return b;
    },
    writeFile: (p: string, b: Uint8Array) => {
      if (p === falhar.write) throw new Error("cota");
      files.set(p, new Uint8Array(b));
    },
    rename: (a: string, b: string) => {
      const v = files.get(a);
      if (!v) throw new Error("missing");
      files.set(b, v);
      files.delete(a);
    },
    unlink: (p: string) => {
      if (!files.delete(p)) throw new Error("missing");
    },
  };
  const FSSync = vi.fn(async () => {
    syncs++;
    if (falhar.sync === syncs) throw new Error("quota");
    disco = new Map(files);
  });
  return {
    core: { FS, filePaths: () => DIRS, FSSync },
    files,
    falhar,
    estado: () => Object.fromEntries([...files].sort().map(([k, v]) => [k, [...v]])),
    reabrir: () => fakeCore(Object.fromEntries([...disco].map(([k, v]) => [k, [...v]]))),
  };
}

const ANTES_FS = { "/saves/demo.sav": [1], "/states/demo.ss3": [3], "/photos/demo-20261012-101500.png": [5] };
const ANTES_DATA = {
  "pokedex:challenges": JSON.stringify({ [ROM]: { rom: ROM, futuro: true }, "outra.gba": { rom: "outra.gba" } }),
  "pokedex:trainer-log": JSON.stringify({ [ROM]: { rom: ROM, n: 1 } }),
  "pokedex:lang": "pt",
};

async function capsula(): Promise<Capsule> {
  return {
    app: "pokemu-capsule",
    version: 1,
    exportedAt: "2026-10-12T00:00:00Z",
    rom: { fileName: ROM },
    coreVersion: "c",
    files: [await capsuleFile("save", ".sav", new Uint8Array([9])), await capsuleFile("state", ".ss1", new Uint8Array([8]))],
    data: { "pokedex:trainer-log": { rom: ROM, n: 2 } },
  };
}

const lerJson = (v: string | null) => {
  try {
    return JSON.parse(v ?? "null") as unknown;
  } catch {
    return v;
  }
};
const dados = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, lerJson(localStorage.getItem(k))]));
let antesData: Record<string, unknown>;

beforeEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  for (const [k, v] of Object.entries(ANTES_DATA)) localStorage.setItem(k, v);
  antesData = dados();
  resetGuideStoreForTests();
  resetRestoreLockForTests();
  await writeGuideText(ROM, "guia do futuro");
});

async function restaurar(f: ReturnType<typeof fakeCore>, mode: RestoreMode) {
  const c = await capsula();
  return runRestore(f.core, c, ROM, planRestore(c, new Set(), "c"), mode);
}

describe("restauração completa", () => {
  it("replace (ramificação) deixa a aventura só com o que a cápsula traz (AUD-03)", async () => {
    const f = fakeCore(ANTES_FS);
    await restaurar(f, "replace");
    expect(f.estado()).toEqual({
      "/photos/demo-20261012-101500.png": [5],
      "/saves/demo.sav": [9],
      "/states/demo.ss1": [8],
    });
    expect(localStorage.getItem("pokedex:challenges")).toBe(JSON.stringify({ "outra.gba": { rom: "outra.gba" } }));
    expect(JSON.parse(localStorage.getItem("pokedex:trainer-log")!)[ROM].n).toBe(2);
    expect(await readGuideText(ROM)).toBeNull();
    expect(localStorage.getItem("pokedex:lang")).toBe("pt");
  });

  it("merge (cápsula importada) só acrescenta e substitui", async () => {
    const f = fakeCore(ANTES_FS);
    await restaurar(f, "merge");
    expect(f.estado()["/states/demo.ss3"]).toEqual([3]);
    expect(JSON.parse(localStorage.getItem("pokedex:challenges")!)[ROM]).toEqual({ rom: ROM, futuro: true });
    expect(await readGuideText(ROM)).toBe("guia do futuro");
  });

  it("A → B → A volta exatamente ao conjunto de A", async () => {
    const f = fakeCore(ANTES_FS);
    const a: Capsule = { ...(await capsula()), data: { "pokedex:trainer-log": { rom: ROM, n: 1 } }, guide: "guia A" };
    const b: Capsule = { ...(await capsula()), data: { "pokedex:challenges": { rom: ROM, b: true } } };
    await runRestore(f.core, a, ROM, planRestore(a, new Set(), "c"), "replace");
    const fsA = f.estado();
    const dataA = dados();
    await runRestore(f.core, b, ROM, planRestore(b, new Set(), "c"), "replace");
    expect(await readGuideText(ROM)).toBeNull();
    await runRestore(f.core, a, ROM, planRestore(a, new Set(), "c"), "replace");
    expect(f.estado()).toEqual(fsA);
    expect(dados()).toEqual(dataA);
    expect(await readGuideText(ROM)).toBe("guia A");
  });
});

describe("falha em cada fronteira desfaz tudo (AUD-01)", () => {
  const casos: [string, (f: ReturnType<typeof fakeCore>) => void][] = [
    ["arquivo", (f) => (f.falhar.write = "/states/demo.ss1")],
    [
      "registros",
      () =>
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("quota");
        }),
    ],
    ["detonado", () => vi.spyOn(guideStore, "deleteGuideText").mockRejectedValueOnce(new Error("idb"))],
    ["sincronização", (f) => (f.falhar.sync = 1)],
  ];
  for (const [nome, injetar] of casos) {
    it(`falha no ${nome}: arquivos, registros e detonado voltam`, async () => {
      const f = fakeCore(ANTES_FS);
      injetar(f);
      const erro = await restaurar(f, "replace").catch((e: unknown) => e);
      vi.restoreAllMocks();
      expect(erro).toBeInstanceOf(RestoreError);
      expect(erro).toMatchObject({ reverted: true, pending: false });
      expect(f.estado()).toEqual(ANTES_FS);
      expect(dados()).toEqual(antesData);
      expect(await readGuideText(ROM)).toBe("guia do futuro");
      // Sem diário pendente: a próxima restauração pode começar.
      expect(await recoverPendingRestore(f.core)).toBe("none");
    });
  }

  it("se desfazer também falha, o diário fica e a recuperação termina depois", async () => {
    const f = fakeCore(ANTES_FS);
    const sync = f.core.FSSync;
    // A sincronização da restauração falha, e a da volta também.
    let n = 0;
    f.core.FSSync = vi.fn(async () => {
      n++;
      if (n <= 2) throw new Error("quota");
      await sync();
    });
    const erro = await restaurar(f, "replace").catch((e: unknown) => e);
    expect(erro).toMatchObject({ reverted: false, pending: true });
    // Diário pendente bloqueia uma nova restauração.
    await expect(restaurar(f, "merge")).rejects.toMatchObject({ stage: "prepare", reverted: true });
    expect(await recoverPendingRestore(f.core)).toBe("reverted");
    expect(f.estado()).toEqual(ANTES_FS);
    expect(dados()).toEqual(antesData);
  });

  it("duas restaurações ao mesmo tempo: a segunda é recusada sem mexer em nada", async () => {
    const f = fakeCore(ANTES_FS);
    const c = await capsula();
    const primeira = runRestore(f.core, c, ROM, planRestore(c, new Set(), "c"), "replace");
    await expect(runRestore(f.core, c, ROM, planRestore(c, new Set(), "c"), "merge")).rejects.toMatchObject({
      stage: "busy",
      reverted: true,
    });
    await primeira;
  });
});

describe("queda no meio e reabertura (E02d)", () => {
  /** Faz a operação parar para sempre num ponto, como uma aba fechada. */
  const pontos: [string, (f: ReturnType<typeof fakeCore>) => void, "reverted" | "completed"][] = [
    ["depois dos arquivos e registros", () => vi.spyOn(guideStore, "deleteGuideText").mockReturnValue(new Promise(() => {})), "reverted"],
    ["durante a sincronização", (f) => (f.core.FSSync = vi.fn(() => new Promise(() => {}))), "reverted"],
    [
      "depois de confirmar, antes de limpar as reservas",
      (f) => {
        const sync = f.core.FSSync;
        let n = 0;
        f.core.FSSync = vi.fn(async () => {
          if (++n === 2) return new Promise(() => {});
          await sync();
        });
      },
      "completed",
    ],
  ];
  for (const [nome, parar, esperado] of pontos) {
    it(`queda ${nome}: ao reabrir, ${esperado === "reverted" ? "desfaz" : "conclui"}`, async () => {
      const f = fakeCore(ANTES_FS);
      parar(f);
      void restaurar(f, "replace");
      await new Promise((r) => setTimeout(r, 20));
      vi.restoreAllMocks();
      // Reabrir: o FS volta ao que estava no disco; localStorage e IDB ficam.
      resetRestoreLockForTests();
      const r = f.reabrir();
      expect(await recoverPendingRestore(r.core)).toBe(esperado);
      if (esperado === "reverted") {
        expect(r.estado()).toEqual(ANTES_FS);
        expect(dados()).toEqual(antesData);
        expect(await readGuideText(ROM)).toBe("guia do futuro");
      } else {
        expect(r.estado()).toEqual({
          "/photos/demo-20261012-101500.png": [5],
          "/saves/demo.sav": [9],
          "/states/demo.ss1": [8],
        });
        expect(JSON.parse(localStorage.getItem("pokedex:trainer-log")!)[ROM].n).toBe(2);
      }
      // Recuperar de novo não faz nada: é idempotente.
      expect(await recoverPendingRestore(r.core)).toBe("none");
    });
  }
});
