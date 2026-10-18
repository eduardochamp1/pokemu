// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProgressMap from "./ProgressMap";
import { MAP_MARKS_KEY, MAX_MARKS, reloadMapMarks } from "../lib/mapMarks";

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem("pokedex:lang", "pt");
  reloadMapMarks();
});
afterEach(cleanup);

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement;
const gravadas = () => (JSON.parse(localStorage.getItem(MAP_MARKS_KEY) ?? "{}")["demo.gba"]?.marks ?? []) as unknown[];

it("falha ao gravar mantém o rascunho; depois de recuperar, grava uma vez e limpa (PS-01)", () => {
  render(<ProgressMap rom="demo.gba" />);
  fireEvent.change(campo("Lugar"), { target: { value: "Rota 119" } });
  fireEvent.change(campo("Por que voltar"), { target: { value: "Voltar com Surf" } });
  const espiao = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  fireEvent.click(screen.getByRole("button", { name: "Marcar" }));
  expect(screen.getByRole("alert").textContent).toContain("continua no formulário");
  expect(campo("Lugar").value).toBe("Rota 119");
  expect(campo("Por que voltar").value).toBe("Voltar com Surf");

  espiao.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Marcar" }));
  expect(gravadas()).toHaveLength(1);
  expect(campo("Lugar").value).toBe("");
  expect(campo("Por que voltar").value).toBe("");
});

it("no teto de marcações, o botão trava e a tela diz por quê (PS-06)", () => {
  const marks = Array.from({ length: MAX_MARKS }, (_, i) => ({ id: `m${i}`, place: `Lugar ${i}`, note: "", at: i }));
  localStorage.setItem(MAP_MARKS_KEY, JSON.stringify({ "demo.gba": { rom: "demo.gba", marks } }));
  reloadMapMarks();
  render(<ProgressMap rom="demo.gba" />);
  fireEvent.change(campo("Lugar"), { target: { value: "Mais um" } });
  expect((screen.getByRole("button", { name: "Marcar" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(new RegExp(`Limite de ${MAX_MARKS} lugares`))).toBeTruthy();
});
