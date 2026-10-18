// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCapsule, restoreCapsule, RestoreError, switchToBranch } from "./capsuleActions";
import { resetRestoreLockForTests } from "./restoreTx";
import type { mGBAEmulator } from "./types";
import { capsuleFile, CapsuleIncompleteError, planRestore, type Capsule } from "../lib/capsule";
import * as guideStore from "../lib/guideStore";
import { incompleteMessage, restoreFailureMessage } from "../components/capsuleMessages";

const DIRS = { savePath: "/saves", saveStatePath: "/states", screenshotsPath: "/photos" };

function fakeCore() {
  const files = new Map([["/saves/demo.sav", new Uint8Array([1])]]);
  const FS = {
    readdir: (dir: string) => [...files.keys()].filter((p) => p.startsWith(dir + "/")).map((p) => p.slice(dir.length + 1)),
    readFile: (p: string) => {
      const b = files.get(p);
      if (!b) throw new Error("missing");
      return b;
    },
    writeFile: (p: string, b: Uint8Array) => files.set(p, new Uint8Array(b)),
    rename: (a: string, b: string) => {
      const v = files.get(a);
      if (!v) throw new Error("missing");
      files.set(b, v);
      files.delete(a);
    },
    unlink: (p: string) => files.delete(p),
  };
  const FSSync = vi.fn().mockResolvedValue(undefined);
  const core = { FS, filePaths: () => DIRS, FSSync, version: { projectName: "mGBA", projectVersion: "1" } };
  return { files, FS, FSSync, core: core as unknown as mGBAEmulator };
}

const capsula = (files: Capsule["files"], data: Capsule["data"] = {}): Capsule => ({
  app: "pokemu-capsule",
  version: 1,
  exportedAt: "2026-10-12T00:00:00Z",
  rom: { fileName: "demo.gba" },
  coreVersion: "mGBA 1",
  files,
  data,
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  guideStore.resetGuideStoreForTests();
});

describe("buildCapsule incompleta (AUD-05)", () => {
  it("detonado ilegível não some calado", async () => {
    const { core } = fakeCore();
    vi.spyOn(guideStore, "readGuideText").mockRejectedValue(new Error("idb"));
    const erro = await buildCapsule(core, "demo.gba").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(CapsuleIncompleteError);
    expect((erro as CapsuleIncompleteError).items).toEqual(["guide"]);
    expect(incompleteMessage("pt", erro)).toContain("detonado");
  });

  it("junta tudo o que faltou: save, detonado e registro", async () => {
    const { core, FS } = fakeCore();
    FS.readFile = () => {
      throw new Error("leitura");
    };
    vi.spyOn(guideStore, "readGuideText").mockRejectedValue(new Error("idb"));
    localStorage.setItem("pokedex:trainer-log", "{quebrado");
    const erro = (await buildCapsule(core, "demo.gba").catch((e: unknown) => e)) as CapsuleIncompleteError;
    expect(erro.items).toEqual([".sav", "guide", "pokedex:trainer-log"]);
    expect(incompleteMessage("pt", erro)).toBe(
      "Não foi possível ler: save de bateria, detonado, diário. Nada foi exportado para não gerar uma cópia incompleta."
    );
  });

  it("com tudo legível, monta normalmente", async () => {
    const { core } = fakeCore();
    const c = await buildCapsule(core, "demo.gba");
    expect(c.files.map((f) => f.suffix)).toEqual([".sav"]);
  });
});

describe("restoreCapsule diz se desfez (AUD-01)", () => {
  beforeEach(() => resetRestoreLockForTests());

  it("falha nos arquivos volta tudo e pode dizer que nada mudou", async () => {
    const { core, FS, files } = fakeCore();
    FS.writeFile = () => {
      throw new Error("cota");
    };
    const c = capsula([await capsuleFile("save", ".sav", new Uint8Array([9]))]);
    const erro = await restoreCapsule(core, c, "demo.gba", planRestore(c, new Set([".sav"]), "mGBA 1")).catch((e: unknown) => e);
    expect(erro).toMatchObject({ stage: "files", reverted: true });
    expect([...files.get("/saves/demo.sav")!]).toEqual([1]);
    expect(restoreFailureMessage("pt", erro)).toContain("foi desfeita");
  });

  it("sincronização que nunca volta: não promete nada e deixa a recuperação pendente", async () => {
    const { core, FSSync } = fakeCore();
    FSSync.mockRejectedValue(new Error("quota"));
    const c = capsula([await capsuleFile("save", ".sav", new Uint8Array([9]))]);
    const erro = await restoreCapsule(core, c, "demo.gba", planRestore(c, new Set([".sav"]), "mGBA 1")).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(RestoreError);
    expect(erro).toMatchObject({ stage: "sync", reverted: false, pending: true });
    const msg = restoreFailureMessage("pt", erro);
    expect(msg).not.toContain("como antes");
    expect(msg).toContain("não terminou");
  });

  it("falha nos registros devolve o save que já tinha sido trocado", async () => {
    const { core, files } = fakeCore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const c = capsula([await capsuleFile("save", ".sav", new Uint8Array([9]))], {
      "pokedex:personal-adventures": { title: "nova" },
    });
    const erro = await restoreCapsule(core, c, "demo.gba", planRestore(c, new Set([".sav"]), "mGBA 1")).catch((e: unknown) => e);
    expect(erro).toMatchObject({ stage: "data", reverted: true });
    expect([...files.get("/saves/demo.sav")!]).toEqual([1]);
  });
});

describe("switchToBranch (PS-09)", () => {
  it("recusa ramificação de outra aventura antes de tocar em qualquer arquivo", async () => {
    const { core, files } = fakeCore();
    const c = capsula([await capsuleFile("save", ".sav", new Uint8Array([9]))]);
    await expect(switchToBranch(core, { rom: "outra.gba", capsule: c }, "demo.gba")).rejects.toThrow("ramificação de outra.gba");
    expect([...files.get("/saves/demo.sav")!]).toEqual([1]);
  });

  it("da mesma aventura, restaura", async () => {
    const { core, files } = fakeCore();
    const c = capsula([await capsuleFile("save", ".sav", new Uint8Array([9]))]);
    await switchToBranch(core, { rom: "demo.gba", capsule: c }, "demo.gba");
    expect([...files.get("/saves/demo.sav")!]).toEqual([9]);
  });
});
