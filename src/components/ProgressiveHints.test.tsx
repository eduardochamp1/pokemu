// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProgressiveHints from "./ProgressiveHints";
import { hintFamilyOf, hintsFor } from "../data/hints";

beforeEach(() => localStorage.setItem("pokedex:lang", "pt"));
afterEach(cleanup);

const insignias = (n: number) => Array.from({ length: 8 }, (_, i) => i < n);

describe("dicas em três níveis", () => {
  it("começa sem revelar nada", () => {
    render(<ProgressiveHints rom="Pokemon - Emerald Version (USA).gba" badges={insignias(0)} />);
    expect(screen.getByRole("button", { name: "Mostrar uma pista" })).toBeTruthy();
    expect(screen.queryByText(/Petalburg Woods/)).toBeNull();
    expect(screen.queryByText(/Geodude e Nosepass/)).toBeNull();
  });

  it("revela um nível de cada vez, na ordem", () => {
    render(<ProgressiveHints rom="Pokemon - Emerald Version (USA).gba" badges={insignias(0)} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar uma pista" }));
    expect(screen.getByText(/depois de uma floresta/)).toBeTruthy();
    expect(screen.queryByText(/Petalburg Woods/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar o próximo passo" }));
    expect(screen.getByText(/Petalburg Woods/)).toBeTruthy();
    expect(screen.queryByText(/Geodude e Nosepass/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar a solução" }));
    expect(screen.getByText(/Geodude e Nosepass/)).toBeTruthy();
  });

  it("sugere a etapa da primeira insígnia que falta", () => {
    render(<ProgressiveHints rom="Pokemon - Emerald Version (USA).gba" badges={insignias(2)} />);
    expect((screen.getByLabelText("Etapa") as HTMLSelectElement).value).toBe("2");
  });

  it("trocar de etapa esconde o que estava revelado", () => {
    render(<ProgressiveHints rom="Pokemon - Emerald Version (USA).gba" badges={insignias(0)} />);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar uma pista" }));
    fireEvent.change(screen.getByLabelText("Etapa"), { target: { value: "3" } });
    expect(screen.getByRole("button", { name: "Mostrar uma pista" })).toBeTruthy();
    expect(screen.queryByText(/depois de uma floresta/)).toBeNull();
  });

  /** Um hack sobre FireRed é outro jogo: a dica de FireRed mandaria para o lugar errado. */
  it("romhack não recebe as dicas do jogo em que se baseia", () => {
    render(<ProgressiveHints rom="Pokemon FireRed Rocket Edition.gba" />);
    expect(screen.getByText(/Ainda não há dicas próprias para este jogo/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mostrar uma pista" })).toBeNull();
  });
});

describe("conteúdo das dicas", () => {
  it("cada família tem as oito etapas, em ordem, com os três níveis nos dois idiomas", () => {
    for (const family of ["emerald", "frlg"] as const) {
      const steps = hintsFor(family);
      expect(steps.map((s) => s.badge)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      for (const s of steps) {
        for (const campo of [s.title, s.hint, s.next, s.solution]) {
          expect(campo).toHaveLength(2);
          expect(campo[0].length).toBeGreaterThan(10);
          expect(campo[1].length).toBeGreaterThan(10);
        }
        // A pista é a mais curta: é um empurrão, não a resposta.
        expect(s.hint[0].length).toBeLessThan(s.solution[0].length);
      }
    }
  });

  it("associa pelo nome oficial do arquivo", () => {
    expect(hintFamilyOf("Pokemon - Emerald Version (USA, Europe).gba")).toBe("emerald");
    expect(hintFamilyOf("Pokemon - LeafGreen Version (USA).gba")).toBe("frlg");
    expect(hintFamilyOf("Pokemon - Ruby Version (USA).gba")).toBeUndefined();
    expect(hintFamilyOf("Pokemon Unbound (v2.1.1.1).gba")).toBeUndefined();
  });
});
