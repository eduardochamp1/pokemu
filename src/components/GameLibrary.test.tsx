// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GameLibrary from "./GameLibrary";
import { reloadPersonalAdventures } from "../lib/personalAdventures";
beforeEach(() => { localStorage.clear(); localStorage.setItem("pokedex:lang", "pt"); reloadPersonalAdventures(); });
afterEach(cleanup);
const games = [{ fileName: "Pokemon Red.gb", local: true }, { fileName: "Pokemon Blue.gb", local: true }];
const renderLibrary = () => render(<MemoryRouter><GameLibrary games={games} loading={false} onPlay={vi.fn()} onContinue={vi.fn()} onRefresh={vi.fn()} onImport={vi.fn()} /></MemoryRouter>);
it("favorita um jogo sem iniciá-lo e filtra a biblioteca", () => {
  renderLibrary();
  fireEvent.click(screen.getByRole("button", { name: "Favoritar Pokemon Red.gb" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Só favoritos" }));
  expect(screen.getByRole("button", { name: /GAME BOY.*Red.*Jogar/i })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /GAME BOY.*Blue.*Jogar/i })).toBeNull();
});
it("limpa também o filtro de favoritos quando nenhum resultado é encontrado", () => {
  renderLibrary();
  fireEvent.click(screen.getByRole("checkbox", { name: "Só favoritos" }));
  fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  expect((screen.getByRole("checkbox", { name: "Só favoritos" }) as HTMLInputElement).checked).toBe(false);
  expect(screen.getByRole("button", { name: /GAME BOY.*Blue.*Jogar/i })).toBeTruthy();
});
