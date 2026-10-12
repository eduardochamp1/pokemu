import { describe, expect, it } from "vitest";
import { displayTitle, editionColor, progressSummary, resumeCandidate } from "./libraryView";

describe("displayTitle", () => {
  it("tira extensão, região e o prefixo", () => {
    expect(displayTitle("Pokemon - Emerald Version (USA, Europe).gba")).toBe("Emerald Version");
    expect(displayTitle("gba/Pokemon Unbound (v2.1.1.1).gba")).toBe("Unbound");
    expect(displayTitle("Pocket Monsters Midori (Japan).gb")).toBe("Midori");
  });

  it("nome que não é Pokémon fica como está", () => {
    expect(displayTitle("Tetris.gb")).toBe("Tetris");
  });
});

describe("editionColor", () => {
  it("cada edição oficial tem a sua cor", () => {
    const red = editionColor("Pokemon Red.gb");
    const blue = editionColor("Pokemon Blue.gb");
    expect(red).toBeDefined();
    expect(blue).toBeDefined();
    expect(red!.color).not.toBe(blue!.color);
    expect(editionColor("Pokemon - FireRed Version (USA).gba")!.color).not.toBe(red!.color);
  });

  /** Um hack sobre FireRed não é FireRed: fica com a cor do console. */
  it("romhack não herda a cor da edição em que se baseia", () => {
    expect(editionColor("Pokemon FireRed Rocket Edition.gba")).toBeUndefined();
    expect(editionColor("Pokemon Unbound (v2.1.1.1).gba")).toBeUndefined();
  });
});

describe("progressSummary", () => {
  const oito = (n: number) => Array.from({ length: 8 }, (_, i) => i < n);

  it("insígnias e tempo", () => {
    expect(progressSummary({ badges: oito(3), playSeconds: 12 * 3600 + 5 * 60 }, false)).toBe("3 de 8 insígnias · 12h05");
    expect(progressSummary({ badges: oito(3), playSeconds: 3600 }, true)).toBe("3 of 8 badges · 1h00");
  });

  it("sem insígnia mostra só o tempo", () => {
    expect(progressSummary({ badges: oito(0), playSeconds: 59 * 60 }, false)).toBe("0h59");
  });
});

describe("resumeCandidate", () => {
  const games = [{ fileName: "Red.gb" }, { fileName: "Emerald.gba" }, { fileName: "Crystal.gbc" }];
  const lidos = new Map([
    ["Emerald.gba", 100],
    ["Crystal.gbc", 200],
  ]);

  it("o jogo carregado vem primeiro", () => {
    expect(resumeCandidate(games, "Red.gb", "Emerald.gba", lidos)?.fileName).toBe("Red.gb");
  });

  it("depois a aventura ativa", () => {
    expect(resumeCandidate(games, undefined, "Emerald.gba", lidos)?.fileName).toBe("Emerald.gba");
  });

  it("depois a de save mais recente", () => {
    expect(resumeCandidate(games, undefined, undefined, lidos)?.fileName).toBe("Crystal.gbc");
  });

  it("aventura ativa que saiu da biblioteca não é oferecida", () => {
    expect(resumeCandidate(games, undefined, "Sumiu.gba", lidos)?.fileName).toBe("Crystal.gbc");
  });

  it("biblioteca sem nenhum save lido não tem o que retomar", () => {
    expect(resumeCandidate(games, undefined, undefined, new Map())).toBeUndefined();
  });
});
