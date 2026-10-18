// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const disco = vi.hoisted(() => ({
  gravados: [] as { nome: string; bytes: number[] }[],
  falhar: false,
  carregada: "A.gba" as string | null,
}));

vi.mock("./storage", () => ({
  listLocalSaves: async () => [],
  readLocalSave: async () => new Uint8Array(),
  saveNameFor: (rom: string) => rom.replace(/\.(gb|gbc|gba)$/i, "") + ".sav",
  writeLocalSave: async (nome: string, bytes: Uint8Array) => {
    if (disco.falhar) throw new Error("disco cheio");
    disco.gravados.push({ nome, bytes: [...bytes] });
  },
}));
vi.mock("./core", () => ({ getLoadedRom: () => disco.carregada }));

import { DISK_BACKUP_WINDOW_MS, useDiskBackup } from "./useDiskBackup";
import { getDiskDurability, resetDurabilityForTests } from "./durability";
import type { mGBAEmulator } from "./types";

let save = new Uint8Array([1, 2]);
const core = { getSave: () => save } as unknown as mGBAEmulator;

async function montar() {
  const h = renderHook(() => useDiskBackup({ current: core }, () => {}, () => {}));
  await waitFor(() => expect(h.result.current.localSaves).not.toBeNull());
  return h;
}

beforeEach(() => {
  disco.gravados.length = 0;
  disco.falhar = false;
  disco.carregada = "A.gba";
  save = new Uint8Array([1, 2]);
  resetDurabilityForTests();
});
afterEach(() => vi.useRealTimers());

describe("espelho em disco (AUD-10)", () => {
  it("dois eventos rápidos e silêncio: o disco fica com o segundo conteúdo", async () => {
    const h = await montar();
    vi.useFakeTimers();
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
    });
    save = new Uint8Array([3, 4]);
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
    });
    expect(disco.gravados).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISK_BACKUP_WINDOW_MS);
    });
    expect(disco.gravados.map((g) => g.bytes)).toEqual([[1, 2], [3, 4]]);
    expect(getDiskDurability()).toMatchObject({ state: "saved", available: true });
  });

  it("trocar de jogo não suprime o espelho do outro", async () => {
    const h = await montar();
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
    });
    disco.carregada = "B.gba";
    save = new Uint8Array([7, 8]);
    await act(async () => {
      await h.result.current.backupToDisk("B.gba");
    });
    expect(disco.gravados.map((g) => g.nome)).toEqual(["A.sav", "B.sav"]);
  });

  it("falha não marca o instante: o evento seguinte tenta de novo", async () => {
    const h = await montar();
    disco.falhar = true;
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
    });
    expect(getDiskDurability()).toMatchObject({ state: "failed", error: "disco cheio" });
    disco.falhar = false;
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
    });
    expect(disco.gravados).toHaveLength(1);
    expect(getDiskDurability().state).toBe("saved");
  });

  it("flush grava na hora o que esperava o fim da janela", async () => {
    const h = await montar();
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
    });
    save = new Uint8Array([5, 6]);
    await act(async () => {
      await h.result.current.backupToDisk("A.gba");
      await h.result.current.flushDiskBackups();
    });
    expect(disco.gravados.map((g) => g.bytes)).toEqual([[1, 2], [5, 6]]);
  });
});
