import { describe, it, expect } from "vitest";
import { baseStatsOf, gen3Learnset, genericStats } from "./damageSides";

const stat = (name: string, base_stat: number) => ({ base_stat, effort: 0, stat: { name, url: "" } });
const vg = (name: string) => ({ level_learned_at: 1, move_learn_method: { name: "level-up", url: "" }, version_group: { name, url: "" } });

describe("baseStatsOf", () => {
  it("do formato da PokéAPI para o de gen3Stats", () => {
    const p = { stats: [stat("hp", 40), stat("attack", 45), stat("defense", 35), stat("special-attack", 65), stat("special-defense", 55), stat("speed", 70)] };
    expect(baseStatsOf(p)).toEqual({ hp: 40, atk: 45, def: 35, spa: 65, spd: 55, spe: 70 });
    expect(baseStatsOf({ stats: [stat("hp", 1)] })).toBeUndefined();
  });
});

describe("genericStats", () => {
  it("IV 31, EV 0, natureza neutra", () => {
    // Treecko nv 100: HP 221, Vel ⌊(140+31)·1⌋+5 = 176
    const s = genericStats({ hp: 40, atk: 45, def: 35, spa: 65, spd: 55, spe: 70 }, 100);
    expect(s.hp).toBe(221);
    expect(s.maxHp).toBe(221);
    expect(s.spe).toBe(176);
  });
});

describe("gen3Learnset", () => {
  it("só golpes aprendidos em algum jogo de Gen 3, sem repetir, em ordem", () => {
    const p = {
      moves: [
        { move: { name: "tackle", url: "" }, version_group_details: [vg("red-blue"), vg("emerald")] },
        { move: { name: "moonblast", url: "" }, version_group_details: [vg("x-y")] },
        { move: { name: "absorb", url: "" }, version_group_details: [vg("firered-leafgreen")] },
      ],
    };
    expect(gen3Learnset(p)).toEqual(["absorb", "tackle"]);
  });
});

describe("baseStatsOf com past_stats", () => {
  const st = (name: string, base_stat: number) => ({ base_stat, stat: { name } });
  const hoje = [st("hp", 35), st("attack", 55), st("defense", 40), st("special-attack", 50), st("special-defense", 50), st("speed", 90)];

  /** Pikachu: Defesa 30 e Defesa Especial 40 até a Gen 5. */
  it("usa o valor da época, não o de hoje", () => {
    const pikachu = {
      stats: hoje,
      past_stats: [
        { generation: { name: "generation-i" }, stats: [st("special", 50)] },
        { generation: { name: "generation-v" }, stats: [st("defense", 30), st("special-defense", 40)] },
      ],
    };
    expect(baseStatsOf(pikachu)).toEqual({ hp: 35, atk: 55, def: 30, spa: 50, spd: 40, spe: 90 });
  });

  it("mudança anterior à Gen 3 não se aplica", () => {
    const p = { stats: hoje, past_stats: [{ generation: { name: "generation-ii" }, stats: [st("defense", 1)] }] };
    expect(baseStatsOf(p)?.def).toBe(40);
  });

  it("com duas mudanças depois da Gen 3, vale a mais antiga", () => {
    const p = {
      stats: hoje,
      past_stats: [
        { generation: { name: "generation-vii" }, stats: [st("attack", 60)] },
        { generation: { name: "generation-v" }, stats: [st("attack", 50)] },
      ],
    };
    expect(baseStatsOf(p)?.atk).toBe(50);
  });
});
