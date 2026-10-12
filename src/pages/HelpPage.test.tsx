// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HelpPage from "./HelpPage";
import { reloadPersonalAdventures, updatePersonalAdventure } from "../lib/personalAdventures";

vi.mock("../emulator/core", () => ({ getLoadedRom: () => "Red.gb" }));
vi.mock("../lib/trainerLog", () => ({ useTrainerEntries: () => [] }));
vi.mock("../lib/legacyAdventures", () => ({ useLegacyAdventures: () => [] }));
beforeEach(() => {
  localStorage.clear(); localStorage.setItem("pokedex:lang", "pt"); reloadPersonalAdventures();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{fileName: "Red.gb"}, {fileName: "Blue.gb"}] }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("pesquisa sem depender de acentos e deixa trechos recolhidos", async () => {
  updatePersonalAdventure("Red.gb", { guide: {title: "Meu guia", source: "", text: "Cidade\nProcure a saída.\n\nCaverna\nRevele este trecho quando quiser."} });
  render(<MemoryRouter><HelpPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Buscar cidade, item ou obstáculo"), { target: { value: "saida" } });
  expect(screen.getByText(/1 trechos encontrados/)).toBeTruthy();
  expect(screen.queryByText("Revele este trecho quando quiser.")).toBeNull();
  const summary = screen.getByText("Cidade", { selector: "summary" });
  expect(summary.closest("details")!.open).toBe(false);
  await waitFor(() => expect(screen.getByRole("option", { name: "Blue.gb" })).toBeTruthy());
});
it("importa texto e não transforma HTML do detonado em código", async () => {
  render(<MemoryRouter><HelpPage /></MemoryRouter>);
  const file = new File([""], "guia.txt", { type: "text/plain" });
  Object.defineProperty(file, "text", { value: async () => 'Introdução\n<img src=x onerror=alert(1)>' });
  fireEvent.change(screen.getByLabelText("Arquivo do detonado (.txt ou .md)"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText("guia.txt")).toBeTruthy());
  expect(document.querySelector('img[src="x"]')).toBeNull();
  expect(screen.getByText(/<img src=x/)).toBeTruthy();
});

it("troca as fontes junto com o jogo sem sugerir FireRed para Rocket Edition", async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => [{ fileName: "Pokemon FireRed Rocket Edition (1).gba" }] } as Response);
  render(<MemoryRouter initialEntries={["/ajuda?rom=Pokemon%20-%20FireRed%20Version%20(USA).gba"]}><HelpPage /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Pokémon Mythology ↗" }).getAttribute("href")).toContain("firered-leafgreen");
  await waitFor(() => expect(screen.getByRole("option", { name: "Pokemon FireRed Rocket Edition (1).gba" })).toBeTruthy());
  fireEvent.change(screen.getByLabelText("Jogo da biblioteca"), { target: { value: "Pokemon FireRed Rocket Edition (1).gba" } });
  expect(screen.queryByRole("link", { name: "Pokémon Mythology ↗" })).toBeNull();
  const link = screen.getByRole("link", { name: "ROM Hack Guides ↗" });
  expect(link.getAttribute("href")).toContain("rocket-edition");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});
