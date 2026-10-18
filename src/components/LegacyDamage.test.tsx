// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LegacyDamage from "./LegacyDamage";
import { recordLegacyAdventure, reloadLegacyAdventures } from "../lib/legacyAdventures";
import { reloadActiveAdventure } from "../lib/activeAdventure";
import { parseGen1Save, parseGen2Save } from "../emulator/saveParse/legacy";
import { legacyFixture } from "../emulator/saveParse/legacy.fixture";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("pokedex:lang", "pt");
  reloadLegacyAdventures();
  reloadActiveAdventure();
});
afterEach(cleanup);

const montar = (url = "/dano") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <LegacyDamage />
    </MemoryRouter>
  );

it("sem aventura de Gen 1/2, não aparece", () => {
  const { container } = montar();
  expect(container.innerHTML).toBe("");
});

it("calcula com o time lido de um save de Gen 1", async () => {
  recordLegacyAdventure("Pokemon Red.gb", parseGen1Save(legacyFixture("red").bytes, "red", false)!);
  montar();
  await waitFor(() => expect(screen.getByLabelText("Atacante")).toBeTruthy());
  await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/de dano|Não tem efeito/));
  // O alvo é suposição, e a tela diz.
  expect(screen.getByText(/O alvo é uma suposição/)).toBeTruthy();
  // Clima só existe na Gen 2.
  expect(screen.queryByLabelText("Clima")).toBeNull();
});

it("na Gen 2 oferece clima, e o cenário vindo de Ginásios escolhe o alvo", async () => {
  recordLegacyAdventure("Pokemon Crystal.gbc", parseGen2Save(legacyFixture("crystal").bytes, "crystal")!);
  montar("/dano?atk=0&def=miltank&nivel=20");
  await waitFor(() => expect(screen.getByLabelText("Clima")).toBeTruthy());
  expect((screen.getByLabelText("Nível do alvo") as HTMLInputElement).value).toBe("20");
  const alvo = screen.getByLabelText("Alvo") as HTMLSelectElement;
  expect(alvo.selectedOptions[0].textContent).toMatch(/Miltank/i);
});

it("o cenário atk=1 escolhe o segundo membro, e índice inválido cai no primeiro (AUD-14)", async () => {
  const base = parseGen2Save(legacyFixture("crystal").bytes, "crystal")!;
  const primeiro = base.party.find((m) => !m.egg && m.stats && m.level !== null)!;
  const save = { ...base, party: [primeiro, { ...primeiro, slot: 2, nickname: "SEGUNDO" }] };
  const lutadores = save.party;
  recordLegacyAdventure("Pokemon Crystal.gbc", save);
  montar("/dano?atk=1&def=miltank&nivel=20");
  await waitFor(() => expect(screen.getByLabelText("Atacante")).toBeTruthy());
  const atacante = screen.getByLabelText("Atacante") as HTMLSelectElement;
  expect(Number(atacante.value)).toBe(lutadores.indexOf(save.party[1]));
  expect(atacante.selectedOptions[0].textContent).toMatch(/SEGUNDO/);
  cleanup();
  montar("/dano?atk=9");
  await waitFor(() => expect(screen.getByLabelText("Atacante")).toBeTruthy());
  expect((screen.getByLabelText("Atacante") as HTMLSelectElement).value).toBe("0");
});

it("ativa de outra geração: não analisa a primeira de Gen 1/2 calada", async () => {
  recordLegacyAdventure("Pokemon Red.gb", parseGen1Save(legacyFixture("red").bytes, "red", false)!);
  localStorage.setItem("pokedex:active-adventure", "Emerald.gba");
  reloadActiveAdventure();
  montar();
  expect((screen.getByLabelText("Aventura") as HTMLSelectElement).value).toBe("");
  expect(screen.queryByLabelText("Atacante")).toBeNull();
});
