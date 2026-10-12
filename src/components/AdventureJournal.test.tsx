// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdventureJournal from "./AdventureJournal";
import { reloadPersonalAdventures } from "../lib/personalAdventures";

beforeEach(() => { localStorage.clear(); localStorage.setItem("pokedex:lang", "pt"); reloadPersonalAdventures(); });
afterEach(cleanup);
it("guarda notas e objetivos, permite concluir o objetivo e não mistura ROMs", () => {
  const view = render(<MemoryRouter><AdventureJournal rom="Red.gb" /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Nova anotação"), { target: { value: "Voltar à caverna" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar anotação" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.change(screen.getByLabelText("Editar anotação"), { target: { value: "Voltar à caverna amanhã" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar anotação" }));
  fireEvent.change(screen.getByLabelText("Próximo objetivo"), { target: { value: "Ganhar insígnia" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar objetivo" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Ganhar insígnia" }));
  expect((screen.getByRole("checkbox", { name: "Ganhar insígnia" }) as HTMLInputElement).checked).toBe(true);
  view.rerender(<MemoryRouter><AdventureJournal key="Blue.gb" rom="Blue.gb" /></MemoryRouter>);
  expect(screen.queryByText("Voltar à caverna amanhã")).toBeNull();
  view.rerender(<MemoryRouter><AdventureJournal key="Red.gb" rom="Red.gb" /></MemoryRouter>);
  expect(screen.getByText("Voltar à caverna amanhã")).toBeTruthy();
});
