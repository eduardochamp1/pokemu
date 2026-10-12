// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import SlotName from "./SlotName";
import { reloadPersonalAdventures } from "../lib/personalAdventures";
beforeEach(() => { localStorage.clear(); localStorage.setItem("pokedex:lang", "pt"); reloadPersonalAdventures(); });
afterEach(cleanup);
it("renomeia um ponto e mantém o nome ligado ao slot e à ROM", () => {
  const view = render(<SlotName rom="Red.gb" slot={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Nome do ponto 1" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nome do ponto 1" }), { target: {value: "Antes do ginásio"} });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(screen.getByText("Antes do ginásio")).toBeTruthy();
  view.rerender(<SlotName key="blue" rom="Blue.gb" slot={1} />);
  expect(screen.queryByText("Antes do ginásio")).toBeNull();
  view.rerender(<SlotName key="red" rom="Red.gb" slot={1} />);
  expect(screen.getByText("Antes do ginásio")).toBeTruthy();
});
