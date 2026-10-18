// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ChallengePanel from "./ChallengePanel";
import { reloadChallenges } from "../lib/challenge";
import { reloadTrainerLog } from "../lib/trainerLog";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("pokedex:lang", "pt");
  reloadChallenges();
  reloadTrainerLog();
});
afterEach(cleanup);

const iniciar = () => {
  render(<ChallengePanel rom="Emerald.gba" />);
  fireEvent.click(screen.getByRole("button", { name: "Começar um desafio neste jogo" }));
};

it("começa com as duas regras clássicas marcadas", () => {
  iniciar();
  expect((screen.getByLabelText(/Só o primeiro encontro de cada área/) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText(/Pokémon que desmaia não é mais usado/) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText(/Sem itens durante as batalhas/) as HTMLInputElement).checked).toBe(false);
});

it("registra um encontro e recusa um segundo na mesma área", () => {
  iniciar();
  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Rota 101" } });
  fireEvent.change(screen.getByLabelText("Pokémon"), { target: { value: "Zigzagoon" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar" })[0]);
  expect(screen.getByText("Rota 101")).toBeTruthy();
  expect(screen.getByText(/Zigzagoon/)).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Área"), { target: { value: "rota 101" } });
  expect(screen.getByText("Esta área já tem um encontro registrado.")).toBeTruthy();
  expect((screen.getAllByRole("button", { name: "Registrar" })[0] as HTMLButtonElement).disabled).toBe(true);
});

it("registra uma perda e ela sobrevive a remontar a tela", () => {
  iniciar();
  fireEvent.change(screen.getByLabelText("Quem"), { target: { value: "ZE" } });
  fireEvent.change(screen.getByLabelText("Como foi"), { target: { value: "Crítico do Nosepass" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar" })[1]);
  cleanup();
  reloadChallenges();
  render(<ChallengePanel rom="Emerald.gba" />);
  expect(screen.getByText("ZE")).toBeTruthy();
  expect(screen.getByText(/Crítico do Nosepass/)).toBeTruthy();
});

/** O site só confere o nível; o resto é registro de quem joga, e a tela diz. */
it("deixa claro o que é conferido e o que é manual", () => {
  iniciar();
  expect(screen.getByText(/O site só confere o nível do time/)).toBeTruthy();
});

it("encerrar pede confirmação antes de apagar", () => {
  iniciar();
  fireEvent.click(screen.getByRole("button", { name: "Encerrar o desafio…" }));
  expect(screen.getByText(/Apagar as regras, os encontros e as perdas/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
  expect(screen.getByRole("button", { name: "Começar um desafio neste jogo" })).toBeTruthy();
});

it("aventura de Gen 1/2: o time lido do save é conferido contra o limite fixo (PS-05)", async () => {
  const { recordLegacyAdventure, reloadLegacyAdventures } = await import("../lib/legacyAdventures");
  const { parseGen1Save } = await import("../emulator/saveParse/legacy");
  const { legacyFixture } = await import("../emulator/saveParse/legacy.fixture");
  const save = parseGen1Save(legacyFixture("red").bytes, "red", false)!;
  const membro = save.party.find((m) => !m.egg && m.level !== null)!;
  recordLegacyAdventure("Red.gb", save);
  reloadLegacyAdventures();
  render(<ChallengePanel rom="Red.gb" />);
  fireEvent.click(screen.getByRole("button", { name: "Começar um desafio neste jogo" }));
  fireEvent.change(screen.getByLabelText("Limite"), { target: { value: "fixo" } });
  fireEvent.change(screen.getByLabelText("Nível"), { target: { value: String(Math.max(1, membro.level! - 1)) } });
  expect(screen.getByRole("status").textContent).toContain(membro.nickname);
  // O limite pelo líder não é oferecido como disponível em Red.
  const gym = screen.getByRole("option", { name: /próximo líder/ }) as HTMLOptionElement;
  expect(gym.disabled).toBe(true);
});

it("falha ao gravar mantém regra, encontro e perda digitados (PS-01)", async () => {
  const { vi } = await import("vitest");
  iniciar();
  const preencher = () => {
    fireEvent.change(screen.getByLabelText("Regra sua"), { target: { value: "Sem cura em batalha" } });
    fireEvent.change(screen.getByLabelText("Área"), { target: { value: "Rota 102" } });
    fireEvent.change(screen.getByLabelText("Pokémon"), { target: { value: "Ralts" } });
    fireEvent.change(screen.getByLabelText("Quem"), { target: { value: "Zigzagoon" } });
  };
  preencher();
  const espiao = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar" })[0]);
  fireEvent.click(screen.getAllByRole("button", { name: "Registrar" })[1]);
  expect((screen.getByLabelText("Regra sua") as HTMLInputElement).value).toBe("Sem cura em batalha");
  expect((screen.getByLabelText("Área") as HTMLInputElement).value).toBe("Rota 102");
  expect((screen.getByLabelText("Quem") as HTMLInputElement).value).toBe("Zigzagoon");
  expect(screen.getByRole("alert").textContent).toContain("continua no formulário");
  espiao.mockRestore();

  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  expect((screen.getByLabelText("Regra sua") as HTMLInputElement).value).toBe("");
});
