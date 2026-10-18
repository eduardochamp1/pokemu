// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Branch } from "../lib/branches";
import type { Capsule } from "../lib/capsule";

const listBranches = vi.fn<(rom: string) => Promise<Branch[]>>();
const switchToBranch = vi.fn();
const saveBranch = vi.fn<(b: Branch) => Promise<void>>();
vi.mock("../lib/branches", async (orig) => ({
  ...(await orig<typeof import("../lib/branches")>()),
  listBranches: (rom: string) => listBranches(rom),
  saveBranch: (b: Branch) => saveBranch(b),
}));
vi.mock("../emulator/core", () => ({ getCore: vi.fn().mockResolvedValue({}), getLoadedRom: () => undefined }));
vi.mock("../emulator/capsuleActions", () => ({
  buildCapsule: vi.fn().mockResolvedValue({ files: [] }),
  switchToBranch: (...args: unknown[]) => switchToBranch(...args),
}));

const { default: AdventureBranches } = await import("./AdventureBranches");

const capsule = { app: "pokemu-capsule", version: 1, exportedAt: "", rom: { fileName: "x" }, coreVersion: "", files: [], data: {} } as Capsule;
const ramo = (rom: string, name: string): Branch => ({ id: `${rom}-${name}`, rom, name, createdAt: 0, capsule });

function adiado<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  localStorage.setItem("pokedex:lang", "pt");
  listBranches.mockReset();
  switchToBranch.mockReset();
  saveBranch.mockReset();
  saveBranch.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("resposta atrasada de A não substitui a lista de B (PS-09)", async () => {
  const a = adiado<Branch[]>();
  const b = adiado<Branch[]>();
  listBranches.mockImplementation((rom) => (rom === "A.gba" ? a.promise : b.promise));
  render(<AdventureBranches roms={["A.gba", "B.gba"]} currentRom="A.gba" onRestored={() => {}} />);
  fireEvent.change(screen.getByLabelText("Jogo"), { target: { value: "B.gba" } });
  await act(async () => b.resolve([ramo("B.gba", "Ramo de B")]));
  await act(async () => a.resolve([ramo("A.gba", "Ramo de A")]));
  expect(screen.getByText("Ramo de B")).toBeTruthy();
  expect(screen.queryByText("Ramo de A")).toBeNull();
});

it("o seletor trava durante a troca e o destino é o do clique", async () => {
  listBranches.mockResolvedValue([ramo("A.gba", "Ramo de A")]);
  const troca = adiado<void>();
  switchToBranch.mockReturnValue(troca.promise);
  render(<AdventureBranches roms={["A.gba", "B.gba"]} currentRom="A.gba" onRestored={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Voltar a esta" }));
  await act(async () => {});
  expect((screen.getByLabelText("Jogo") as HTMLSelectElement).disabled).toBe(true);
  await act(async () => troca.resolve());
  expect(switchToBranch).toHaveBeenCalledTimes(1);
  expect(switchToBranch.mock.calls[0][1]).toMatchObject({ rom: "A.gba" });
  expect(switchToBranch.mock.calls[0][2]).toBe("A.gba");
});

it("banco que falha não vira 'nenhuma ramificação'; ler de novo recupera (PS-07)", async () => {
  listBranches.mockRejectedValueOnce(new Error("bloqueado")).mockResolvedValue([ramo("A.gba", "Ramo de A")]);
  render(<AdventureBranches roms={["A.gba"]} currentRom="A.gba" onRestored={() => {}} />);
  expect((await screen.findByRole("alert")).textContent).toContain("não foram apagadas");
  expect(screen.queryByText("Nenhuma ramificação guardada para este jogo.")).toBeNull();
  // Guardar não decide limite com uma lista que não foi lida.
  fireEvent.click(screen.getByRole("button", { name: "Guardar o estado atual" }));
  expect(screen.getByText(/não foi lida/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Ler de novo" }));
  expect(await screen.findByText("Ramo de A")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("duas ramificações exportadas voltam em outro perfil com nome e data (PS-04)", async () => {
  vi.stubGlobal("crypto", (await import("node:crypto")).webcrypto);
  const { capsuleFile } = await import("../lib/capsule");
  listBranches.mockResolvedValue([]);
  render(<AdventureBranches roms={["A.gba"]} currentRom="A.gba" onRestored={() => {}} />);
  await screen.findByText("Nenhuma ramificação guardada para este jogo.");
  const arquivo = async (name: string, createdAt: number) =>
    new File(
      [
        JSON.stringify({
          ...capsule,
          exportedAt: "2026-10-12T00:00:00Z",
          rom: { fileName: "A.gba" },
          files: [await capsuleFile("save", ".sav", new Uint8Array([createdAt % 256]))],
          branch: { name, createdAt },
        }),
      ],
      `${name}.pokemu.json`
    );
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  for (const [nome, quando] of [["Antes da Elite", 1000], ["Com Swampert", 2000]] as const) {
    fireEvent.change(input, { target: { files: [await arquivo(nome, quando)] } });
    await screen.findByText(new RegExp(`"${nome}" importada`));
  }
  expect(saveBranch.mock.calls.map(([b]) => [b.rom, b.name, b.createdAt, b.capsule.files[0].suffix])).toEqual([
    ["A.gba", "Antes da Elite", 1000, ".sav"],
    ["A.gba", "Com Swampert", 2000, ".sav"],
  ]);
  // O metadado da exportação não fica dentro da cápsula guardada.
  expect("branch" in saveBranch.mock.calls[0][0].capsule).toBe(false);
});
