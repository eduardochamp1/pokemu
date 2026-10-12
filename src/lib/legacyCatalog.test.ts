import { describe, expect, it } from "vitest";
import {
  chartMultiplier,
  gymSetOf,
  legacyBadges,
  legacyBattleTeam,
  legacyGyms,
  loadLegacyCatalog,
} from "./legacyCatalog";
import { loadCatalog } from "./offlineCatalog";
import { gen3TypeMultiplier } from "./gen3Damage";
import { GEN3_TYPES } from "./teamLab";
import { rankForGym } from "./gymGuide";
import type { LegacySave } from "../emulator/saveParse/legacy";

describe("catálogo de Gen 1", () => {
  it("151 espécies e 165 golpes, sem buraco", async () => {
    const c = await loadLegacyCatalog(1);
    expect(c.species.map((s) => s[0])).toEqual(Array.from({ length: 151 }, (_, i) => i + 1));
    expect(c.moves.map((m) => m[0])).toEqual(Array.from({ length: 165 }, (_, i) => i + 1));
  });

  it("os tipos e o status Especial são os da época", async () => {
    const c = await loadLegacyCatalog(1);
    const sp = (slug: string) => c.species.find((s) => s[1] === slug)!;
    const mv = (slug: string) => c.moves.find((m) => m[1] === slug)!;
    expect(sp("magnemite")[2]).toEqual(["electric"]);
    expect(sp("magnemite")[3]).toEqual([25, 35, 70, 45, 95]);
    expect(mv("bite")[2]).toBe("normal");
    expect(mv("gust")[2]).toBe("normal");
    expect(mv("karate-chop")[2]).toBe("normal");
    expect(mv("dig")[3]).toBe(100);
    for (const s of c.species) for (const t of s[2]) expect(["dark", "steel"]).not.toContain(t);
  });

  it("a tabela de tipos tem as diferenças da Gen 1", async () => {
    const mult = chartMultiplier(await loadLegacyCatalog(1));
    expect(mult("ghost", ["psychic"])).toBe(0);
    expect(mult("bug", ["poison"])).toBe(2);
    expect(mult("poison", ["bug"])).toBe(2);
    expect(mult("ice", ["fire"])).toBe(1);
    expect(mult("water", ["rock", "ground"])).toBe(4);
  });

  it("Red/Blue e Yellow têm times diferentes para o mesmo líder", async () => {
    const c = await loadLegacyCatalog(1);
    const brock = (set: "rb" | "yellow") => legacyGyms(c, set)[0].party.map((m) => [m.species, m.level]);
    expect(brock("rb")).toEqual([["geodude", 12], ["onix", 14]]);
    expect(brock("yellow")).toEqual([["geodude", 10], ["onix", 12]]);
    expect(legacyGyms(c, "yellow")[2].party.map((m) => m.species)).toEqual(["raichu"]);
  });

  /** O golpe que só o líder tem (TM do ginásio) vem das exceções do jogo. */
  it("os golpes dos líderes incluem a exceção de cada um", async () => {
    const gyms = legacyGyms(await loadLegacyCatalog(1), "rb");
    const golpes = (leader: string, species: string) =>
      gyms.find((g) => g.leader === leader)!.party.find((m) => m.species === species)!.moves.map((m) => m.slug);
    expect(golpes("Brock", "onix")).toEqual(["tackle", "screech", "bide"]);
    expect(golpes("Misty", "starmie")).toEqual(["tackle", "water-gun", "bubble-beam"]);
    expect(golpes("Giovanni", "rhydon")).toContain("fissure");
  });

  it("as oito insígnias de Kanto, na ordem do save", async () => {
    expect(legacyBadges(await loadLegacyCatalog(1), "rb").map((b) => b.name)).toEqual([
      "Boulder Badge", "Cascade Badge", "Thunder Badge", "Rainbow Badge",
      "Soul Badge", "Marsh Badge", "Volcano Badge", "Earth Badge",
    ]);
  });
});

describe("catálogo de Gen 2", () => {
  it("251 espécies e 251 golpes", async () => {
    const c = await loadLegacyCatalog(2);
    expect(c.species).toHaveLength(251);
    expect(c.moves).toHaveLength(251);
  });

  /** Duas fontes independentes: a decompilação e a PokéAPI têm que concordar. */
  it("tipos de espécie e status base batem com o catálogo de Gen 3 (PokéAPI)", async () => {
    const g2 = await loadLegacyCatalog(2);
    const g3 = await loadCatalog();
    for (const s of g2.species) {
      const outro = g3.species.find((x) => x[0] === s[0])!;
      expect(s[2], s[1]).toEqual(outro[2]);
      // Gen 2: hp, atk, def, spe, spa, spd. Gen 3: hp, atk, def, spa, spd, spe.
      const [hp, atk, def, spe, spa, spd] = s[3];
      expect([hp, atk, def, spa, spd, spe], s[1]).toEqual(outro[3]);
    }
  });

  it("a tabela de tipos é a mesma da Gen 3", async () => {
    const mult = chartMultiplier(await loadLegacyCatalog(2));
    for (const atk of GEN3_TYPES) {
      for (const def of GEN3_TYPES) expect(mult(atk, [def]), `${atk}>${def}`).toBe(gen3TypeMultiplier(atk, [def]));
    }
  });

  it("dano fixo não vira poder", async () => {
    const c = await loadLegacyCatalog(2);
    expect(c.moves.find((m) => m[1] === "sonic-boom")![3]).toBeNull();
    expect(c.moves.find((m) => m[1] === "dragon-rage")![3]).toBeNull();
  });

  it("dezesseis ginásios: Johto e depois Kanto, na ordem das insígnias do save", async () => {
    const c = await loadLegacyCatalog(2);
    expect(legacyGyms(c, "gsc").map((g) => g.leader)).toEqual([
      "Falkner", "Bugsy", "Whitney", "Morty", "Chuck", "Jasmine", "Pryce", "Clair",
      "Brock", "Misty", "Lt. Surge", "Erika", "Janine", "Sabrina", "Blaine", "Blue",
    ]);
    expect(legacyGyms(c, "gsc")[7].party.map((m) => [m.species, m.level])).toEqual([
      ["dragonair", 37], ["dragonair", 37], ["dragonair", 37], ["kingdra", 40],
    ]);
  });
});

const mon = (national: number, nickname: string, level: number, moves: number[], egg = false) => ({
  national, nickname, level, egg, moves: moves.map((id) => ({ id, pp: 10, ppUps: 0 })),
});
const save = (generation: 1 | 2, game: string, party: ReturnType<typeof mon>[]) =>
  ({ generation, game, party }) as unknown as LegacySave;

describe("time do save", () => {
  it("cada geração usa os tipos dela", async () => {
    // Magnemite com Thunder Shock (84) e um ovo.
    const g1 = legacyBattleTeam(await loadLegacyCatalog(1), save(1, "red", [mon(81, "MAG", 20, [84])]));
    const g2 = legacyBattleTeam(await loadLegacyCatalog(2), save(2, "gold", [mon(81, "MAG", 20, [84]), mon(175, "EGG", 5, [], true)]));
    expect(g1[0].types).toEqual(["electric"]);
    expect(g2).toHaveLength(1);
    expect(g2[0].types).toEqual(["electric", "steel"]);
  });

  it("save de uma geração não é lido com o catálogo da outra", async () => {
    expect(legacyBattleTeam(await loadLegacyCatalog(2), save(1, "red", [mon(4, "CHAR", 10, [10])]))).toEqual([]);
  });

  it("o conjunto de ginásios sai do jogo do save", () => {
    expect(gymSetOf({ generation: 1, game: "blue" })).toBe("rb");
    expect(gymSetOf({ generation: 1, game: "yellow" })).toBe("yellow");
    expect(gymSetOf({ generation: 2, game: "crystal" })).toBe("gsc");
  });

  /** Na Gen 1, Fantasma não atinge Psíquico: recomendar Gastly contra Sabrina seria errado. */
  it("o guia usa a tabela da geração: Inseto serve contra Sabrina, Fantasma não", async () => {
    const c = await loadLegacyCatalog(1);
    const mult = chartMultiplier(c);
    // Gastly com Lick (122) e Beedrill com Twineedle (41).
    const time = legacyBattleTeam(c, save(1, "red", [mon(92, "GASTLY", 40, [122]), mon(15, "BEE", 40, [41])]));
    const sabrina = legacyGyms(c, "rb").find((g) => g.leader === "Sabrina")!;
    const ranking = rankForGym(time, sabrina, mult);
    expect(ranking[0].member.name).toBe("BEE");
    expect(ranking.find((r) => r.member.name === "GASTLY")!.matchups[0].offense.mult).toBe(0);
  });
});
