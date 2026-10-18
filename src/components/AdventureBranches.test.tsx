// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Branch } from "../lib/branches";
import type { Capsule } from "../lib/capsule";

const listBranches = vi.fn<(rom: string) => Promise<Branch[]>>();
const switchToBranch = vi.fn();
vi.mock("../lib/branches", async (orig) => ({
  ...(await orig<typeof import("../lib/branches")>()),
  listBranches: (rom: string) => listBranches(rom),
  saveBranch: vi.fn().mockResolvedValue(undefined),
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
