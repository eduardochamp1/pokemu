// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import WhereILeftOff from "./WhereILeftOff";
import { reloadPersonalAdventures, updatePersonalAdventure } from "../lib/personalAdventures";
import { reloadLegacyAdventures } from "../lib/legacyAdventures";
import { reloadTrainerLog } from "../lib/trainerLog";
import { reloadSessions } from "../lib/sessions";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("pokedex:lang", "pt");
  reloadPersonalAdventures();
  reloadLegacyAdventures();
  reloadTrainerLog();
  reloadSessions();
});
afterEach(cleanup);

it("sem nada registrado, diz como o resumo passa a existir", () => {
  render(<WhereILeftOff rom="Red.gb" />);
  expect(screen.getByText(/Ainda não há nada para resumir/)).toBeTruthy();
});

it("mostra o objetivo aberto mais antigo e a última nota", () => {
  updatePersonalAdventure("Red.gb", {
    goals: [
      { id: "a", text: "Pegar a bicicleta", at: 20 },
      { id: "b", text: "Vencer o Brock", at: 10 },
      { id: "c", text: "Já feito", at: 5, done: true },
    ],
    notes: [
      { id: "n1", text: "Nota velha", at: 100 },
      { id: "n2", text: "Parei na entrada do Mt. Moon", at: 200 },
    ],
  });
  render(<WhereILeftOff rom="Red.gb" />);
  expect(screen.getByText("Vencer o Brock")).toBeTruthy();
  expect(screen.getByText(/e mais 1 em aberto/)).toBeTruthy();
  expect(screen.getByText("Parei na entrada do Mt. Moon")).toBeTruthy();
  expect(screen.queryByText("Nota velha")).toBeNull();
});

/** O resumo não pode fingir que sabe a posição no mapa. */
it("avisa que não sabe em que lugar do jogo a pessoa está", () => {
  render(<WhereILeftOff rom="Red.gb" />);
  expect(screen.getByText(/não sabe em que lugar do jogo você está/)).toBeTruthy();
});
