import { describe, expect, it } from "vitest";
import { JOHTO_BADGES, JOHTO_RAW, resolveJohtoGyms } from "./gymLeadersJohto";
import { loadCatalog } from "../lib/offlineCatalog";
import { legacyBattleTeam } from "../lib/legacyBattle";
import { rankForGym } from "../lib/gymGuide";
import type { LegacySave } from "../emulator/saveParse/legacy";

describe("líderes de Johto", () => {
  /** Um nome digitado errado sumiria em silêncio do guia: o teste é a rede. */
  it("toda espécie e todo golpe existem no catálogo", async () => {
    const c = await loadCatalog();
    const especies = new Set(c.species.map((s) => s[1]));
    const golpes = new Set(c.moves.map((m) => m[1]));
    for (const g of JOHTO_RAW) {
      for (const [species, , moves] of g.party) {
        expect(especies.has(species), `${g.leader}: ${species}`).toBe(true);
        for (const m of moves) expect(golpes.has(m), `${g.leader}: ${m}`).toBe(true);
      }
    }
  });

  it("são oito, com as insígnias na ordem do jogo", () => {
    expect(JOHTO_BADGES.map((b) => b.name)).toEqual([
      "Zephyr Badge", "Hive Badge", "Plain Badge", "Fog Badge",
      "Storm Badge", "Mineral Badge", "Glacier Badge", "Rising Badge",
    ]);
  });

  it("só espécies e golpes que existiam na Gen 2", async () => {
    const c = await loadCatalog();
    for (const gym of resolveJohtoGyms(c)) {
      for (const mon of gym.party) {
        expect(mon.national).toBeLessThanOrEqual(251);
        for (const mv of mon.moves) expect(c.moves.find((m) => m[1] === mv.slug)![0]).toBeLessThanOrEqual(251);
      }
    }
  });

  it("os tipos saem do catálogo: Steelix é Aço e Terra, Kingdra é Água e Dragão", async () => {
    const gyms = resolveJohtoGyms(await loadCatalog());
    const mon = (leader: string, species: string) => gyms.find((g) => g.leader === leader)!.party.find((m) => m.species === species)!;
    expect(mon("Jasmine", "steelix").types).toEqual(["steel", "ground"]);
    expect(mon("Clair", "kingdra").types).toEqual(["water", "dragon"]);
    expect(mon("Whitney", "miltank").moves.find((m) => m.slug === "rollout")?.type).toBe("rock");
  });
});

const mon = (national: number, nickname: string, level: number, moves: number[], egg = false) => ({
  slot: 0, national, nickname, originalTrainer: "ZE", trainerId: 1, level, experience: 0, egg, shiny: false,
  friendship: 70, heldItem: null,
  dvs: { hp: 0, atk: 0, def: 0, spe: 0, special: 0 },
  statExperience: { hp: 0, atk: 0, def: 0, spe: 0, special: 0 },
  moves: moves.map((id) => ({ id, pp: 10, ppUps: 0 })),
  stats: null,
});

const save = (generation: 1 | 2, party: ReturnType<typeof mon>[]) =>
  ({ generation, game: generation === 2 ? "crystal" : "red", party }) as unknown as LegacySave;

describe("legacyBattleTeam", () => {
  it("monta o time de Gen 2 com tipos e golpes do catálogo", async () => {
    const c = await loadCatalog();
    // Cyndaquil com Tackle (33) e Ember (52); um ovo, que não luta.
    const time = legacyBattleTeam(c, save(2, [mon(155, "CYNDA", 14, [33, 52]), mon(175, "EGG", 5, [], true)]));
    expect(time).toEqual([
      {
        name: "CYNDA",
        national: 155,
        level: 14,
        types: ["fire"],
        moves: [
          { slug: "tackle", type: "normal", power: 35 },
          { slug: "ember", type: "fire", power: 40 },
        ],
      },
    ]);
  });

  /** A tabela de tipos da Gen 1 é outra: usar a da Gen 3 daria conselho errado. */
  it("save de Gen 1 não entra", async () => {
    expect(legacyBattleTeam(await loadCatalog(), save(1, [mon(4, "CHAR", 10, [10])]))).toEqual([]);
  });

  it("o guia recomenda Fogo contra o Bugsy", async () => {
    const c = await loadCatalog();
    const time = legacyBattleTeam(c, save(2, [mon(158, "TOTO", 14, [55]), mon(155, "CYNDA", 14, [52])]));
    const bugsy = resolveJohtoGyms(c).find((g) => g.leader === "Bugsy")!;
    expect(rankForGym(time, bugsy)[0].member.name).toBe("CYNDA");
  });
});
