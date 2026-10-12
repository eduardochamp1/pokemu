import { describe, expect, it } from "vitest";
import { parseScenario, scenarioUrl } from "./damageScenario";
import { prepareForGym, type BattleMember } from "./gymGuide";
import type { Gym } from "../data/gymLeaders";

const q = (s: string) => new URLSearchParams(s);

describe("parseScenario", () => {
  it("lê o que scenarioUrl monta", () => {
    const url = scenarioUrl(2, "nosepass", 15);
    expect(parseScenario(q(url.split("?")[1]), 6)).toEqual({ atk: 2, def: { slug: "nosepass", level: 15 } });
  });

  it("posição fora do time é ignorada", () => {
    expect(parseScenario(q("atk=6"), 6)).toEqual({});
    expect(parseScenario(q("atk=-1"), 6)).toEqual({});
    expect(parseScenario(q("atk=0"), 0)).toEqual({});
  });

  it("nível inválido cai em 50, espécie inválida é descartada", () => {
    expect(parseScenario(q("def=geodude&nivel=999"), 6).def).toEqual({ slug: "geodude", level: 50 });
    expect(parseScenario(q("def=geodude"), 6).def).toEqual({ slug: "geodude", level: 50 });
    expect(parseScenario(q("def=<script>&nivel=10"), 6)).toEqual({});
  });
});

const membro = (name: string, level: number, types: BattleMember["types"], moves: BattleMember["moves"]): BattleMember => ({
  name,
  national: 1,
  level,
  types,
  moves,
});

const ROXANNE = {
  leader: "Roxanne",
  party: [
    { national: 74, species: "geodude", level: 12, iv: 0, types: ["rock", "ground"], moves: [{ slug: "tackle", type: "normal", power: 35 }] },
    { national: 299, species: "nosepass", level: 15, iv: 0, types: ["rock"], moves: [{ slug: "rock-tomb", type: "rock", power: 50 }] },
  ],
} as unknown as Gym;

describe("prepareForGym", () => {
  const mudkip = membro("MUDKIP", 14, ["water"], [{ slug: "water-gun", type: "water", power: 40 }]);
  const taillow = membro("TAILLOW", 16, ["normal", "flying"], [{ slug: "peck", type: "flying", power: 35 }]);

  it("escolhe quem bate melhor em cada pokémon do líder", () => {
    const prep = prepareForGym([taillow, mudkip], ROXANNE);
    expect(prep.scenarios.map((s) => [s.attacker, s.defender.species, s.mult, s.attackerIndex])).toEqual([
      ["MUDKIP", "geodude", 4, 1],
      ["MUDKIP", "nosepass", 2, 1],
    ]);
    expect(prep.uncovered).toEqual([]);
  });

  it("diz onde o time não tem golpe super efetivo", () => {
    const prep = prepareForGym([taillow], ROXANNE);
    expect(prep.uncovered.map((m) => m.species)).toEqual(["geodude", "nosepass"]);
  });

  it("no empate de tipo, vale o de nível mais alto", () => {
    const outro = membro("MARSHTOMP", 20, ["water", "ground"], [{ slug: "water-gun", type: "water", power: 40 }]);
    expect(prepareForGym([mudkip, outro], ROXANNE).scenarios[1].attacker).toBe("MARSHTOMP");
  });

  it("compara o nível mais alto dos dois lados", () => {
    const prep = prepareForGym([mudkip, taillow], ROXANNE);
    expect(prep.aceLevel).toBe(15);
    expect(prep.topLevel).toBe(16);
  });
});
