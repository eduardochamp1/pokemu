import { describe, expect, it } from "vitest";
import {
  coverageGaps,
  defensiveTable,
  labMonFromCatalog,
  sharedWeaknesses,
  suggestFromBox,
  type LabMon,
} from "./teamLab";
import { loadCatalog } from "./offlineCatalog";
import type { TypeName } from "../data/typeMatchups";

const mon = (name: string, national: number, types: TypeName[], moves: [string, TypeName, number | null][] = []): LabMon => ({
  name,
  national,
  types,
  moves: moves.map(([n, type, power]) => ({ name: n, type, power })),
});

const charizard = mon("Charizard", 6, ["fire", "flying"], [["flamethrower", "fire", 95]]);
const aerodactyl = mon("Aerodactyl", 142, ["rock", "flying"], [["rock-slide", "rock", 75]]);
const golem = mon("Golem", 76, ["rock", "ground"], [["earthquake", "ground", 100]]);
const swampert = mon("Swampert", 260, ["water", "ground"]);
const ludicolo = mon("Ludicolo", 272, ["water", "grass"]);

describe("defensiveTable", () => {
  it("separa fraco, resistente e imune por tipo de ataque", () => {
    const linha = (t: TypeName) => defensiveTable([charizard, golem]).find((r) => r.type === t)!;
    expect(linha("water").weak).toEqual(["Charizard", "Golem"]);
    expect(linha("electric")).toMatchObject({ weak: ["Charizard"], immune: ["Golem"] });
    expect(linha("fire").resist).toEqual(["Charizard", "Golem"]);
  });
});

describe("sharedWeaknesses", () => {
  it("o tipo que derruba metade do time ou mais", () => {
    const time = [charizard, aerodactyl, golem];
    const tipos = sharedWeaknesses(defensiveTable(time), time.length).map((r) => r.type);
    expect(tipos).toContain("water");
    expect(tipos).toContain("ice");
    expect(tipos).not.toContain("fire");
  });

  /** Um fraco num time de um não é "fraqueza compartilhada". */
  it("um membro só não compartilha fraqueza com ninguém", () => {
    expect(sharedWeaknesses(defensiveTable([charizard]), 1)).toEqual([]);
  });
});

describe("coverageGaps", () => {
  it("lista os tipos que nenhum golpe de dano atinge com vantagem", () => {
    const tipos = coverageGaps([charizard]).map((g) => g.type);
    expect(tipos).toContain("water");
    expect(tipos).not.toContain("grass");
  });

  it("o que é resistido vem antes do que é neutro", () => {
    const gaps = coverageGaps([charizard]);
    expect(gaps[0].best).toBeLessThan(1);
    expect(gaps[gaps.length - 1].best).toBe(1);
  });

  it("golpe de status não conta como cobertura", () => {
    const soStatus = mon("X", 1, ["normal"], [["growl", "normal", null]]);
    expect(coverageGaps([soStatus])).toEqual([]);
  });
});

describe("suggestFromBox", () => {
  const time = [charizard, aerodactyl, golem];
  const compartilhadas = sharedWeaknesses(defensiveTable(time), time.length);

  it("sugere quem segura o que o time não segura, com o motivo", () => {
    // Swampert ignora Elétrico e segura Pedra e Aço (Água fica neutro: o
    // lado Terra apanha). Ludicolo só segura Água e ainda apanha de Gelo.
    const [primeiro] = suggestFromBox([ludicolo, swampert], compartilhadas, time);
    expect(primeiro.mon.name).toBe("Swampert");
    expect(primeiro.covers).toEqual(["electric", "rock", "steel"]);
    expect(primeiro.alsoWeak).toEqual([]);
  });

  it("não sugere quem já está no time nem repete a espécie", () => {
    const s = suggestFromBox([golem, swampert, { ...swampert, name: "Outro Swampert" }], compartilhadas, time);
    expect(s.map((x) => x.mon.name)).toEqual(["Swampert"]);
  });

  it("quem piora mais do que ajuda fica de fora", () => {
    const articuno = mon("Articuno", 144, ["ice", "flying"]);
    expect(suggestFromBox([articuno], compartilhadas, time)).toEqual([]);
  });

  it("sem fraqueza compartilhada não há o que sugerir", () => {
    expect(suggestFromBox([ludicolo], [], time)).toEqual([]);
  });
});

describe("labMonFromCatalog", () => {
  it("monta espécie e golpes pelos números do save", async () => {
    const c = await loadCatalog();
    const m = labMonFromCatalog(c, 258, "MUDKIP", [33, 55, 9999]);
    expect(m).toEqual({
      name: "MUDKIP",
      national: 258,
      types: ["water"],
      moves: [
        { name: "tackle", type: "normal", power: 35 },
        { name: "water-gun", type: "water", power: 40 },
      ],
    });
    expect(labMonFromCatalog(c, 999, "?", [])).toBeNull();
  });
});
