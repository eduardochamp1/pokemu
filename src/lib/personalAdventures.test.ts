// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { PERSONAL_KEY, reloadPersonalAdventures, updatePersonalAdventure, validPersonalAdventure } from "./personalAdventures";
import { collectBackup, parseBackup } from "./backup";

beforeEach(() => { localStorage.clear(); reloadPersonalAdventures(); });
afterEach(() => vi.restoreAllMocks());
describe("Dados pessoais por aventura", () => {
  it("separa nomes e diário por ROM e inclui tudo no backup existente", () => {
    updatePersonalAdventure("Red.gb", { slotNames: ["Antes do ginásio"], notes: [{ id: "n", text: "Explorar", at: 10 }] });
    updatePersonalAdventure("Rocket.gba", { favorite: true });
    const data = JSON.parse(localStorage.getItem(PERSONAL_KEY)!);
    expect(data.find((entry: {rom: string}) => entry.rom === "Red.gb").slotNames).toEqual(["Antes do ginásio"]);
    expect(data.find((entry: {rom: string}) => entry.rom === "Rocket.gba").notes).toEqual([]);
    const backup = collectBackup(localStorage);
    expect(parseBackup(JSON.stringify(backup))?.data[PERSONAL_KEY]).toBe(localStorage.getItem(PERSONAL_KEY));
  });
  it("não altera os dados anteriores se a escrita exceder a quota", () => {
    updatePersonalAdventure("Red.gb", { favorite: true });
    const previous = localStorage.getItem(PERSONAL_KEY);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(() => updatePersonalAdventure("Red.gb", { favorite: false })).toThrow("quota");
    expect(localStorage.getItem(PERSONAL_KEY)).toBe(previous);
  });
  it("recusa dados excessivos e fontes executáveis", () => {
    const base = { rom: "Red.gb", favorite: false, slotNames: [], notes: [], goals: [] };
    expect(validPersonalAdventure({ ...base, slotNames: ["x".repeat(81)] })).toBe(false);
    expect(validPersonalAdventure({ ...base, guide: { title: "Guide", text: "text", source: "javascript:alert(1)" } })).toBe(false);
    expect(validPersonalAdventure({ ...base, notes: [{ id: "n", text: "test", at: NaN }] })).toBe(false);
  });
});

it("leva para o banco o guia que estava inteiro no localStorage", async () => {
  const { migrateInlineGuides, updatePersonalAdventure, reloadPersonalAdventures } = await import("./personalAdventures");
  const { readGuideText, resetGuideStoreForTests } = await import("./guideStore");
  resetGuideStoreForTests();
  reloadPersonalAdventures();
  updatePersonalAdventure("Antigo.gb", { guide: { title: "guia.txt", source: "", text: "Primeira cidade" } });

  await migrateInlineGuides();

  expect(await readGuideText("Antigo.gb")).toBe("Primeira cidade");
  const gravado = JSON.parse(localStorage.getItem("pokedex:personal-adventures")!) as { rom: string; guide: unknown }[];
  expect(gravado.find((e) => e.rom === "Antigo.gb")?.guide).toEqual({ title: "guia.txt", source: "", chars: 15 });
});
