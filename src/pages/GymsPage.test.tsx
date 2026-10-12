// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GymsPage from "./GymsPage";

const data = vi.hoisted(() => ({ entries: [
  { rom: "Ruby.gba", game: "rs", team: [], trainer: { badges: null } },
  { rom: "Emerald.gba", game: "emerald", team: [], trainer: { badges: [true, false, false, false, false, false, false, false] } },
  { rom: "LeafGreen.gba", game: "frlg", team: [], trainer: { badges: [false, false, false, false, false, false, false, false] } },
] }));
vi.mock("../lib/trainerLog", () => ({ useTrainerEntries: () => data.entries }));
vi.mock("../hooks/usePokemon", () => ({
  usePokemonIndex: () => ({ index: undefined }),
  usePokemonsByNames: () => ({ pokemons: [] }),
  useMoveDetails: () => ({}),
}));
vi.mock("../i18n/lang", async importOriginal => ({
  ...await importOriginal<typeof import("../i18n/lang")>(),
  useLang: () => "pt", getLang: () => "pt",
}));
afterEach(cleanup);

describe("Ginásios: saves compatíveis", () => {
  it("ignora a ficha mais recente de Ruby e troca o save ao mudar de jogo", () => {
    render(<MemoryRouter><GymsPage /></MemoryRouter>);
    const selector = screen.getByRole("combobox", { name: "Time da aventura" }) as HTMLSelectElement;
    expect(selector.value).toBe("Emerald.gba");
    expect([...selector.options].map(option => option.value)).toEqual(["Emerald.gba"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Jogo" }), { target: { value: "frlg" } });
    expect(selector.value).toBe("LeafGreen.gba");
    expect([...selector.options].map(option => option.value)).toEqual(["LeafGreen.gba"]);
  });
  it("continua permitindo consultar líderes quando não há save correspondente", () => {
    const previous = data.entries;
    data.entries = [previous[0]];
    try {
      render(<MemoryRouter><GymsPage /></MemoryRouter>);
      expect((screen.getByRole("combobox", { name: "Time da aventura" }) as HTMLSelectElement).disabled).toBe(true);
      expect(screen.getByText("Roxanne")).toBeTruthy();
    } finally { data.entries = previous; }
  });
});
