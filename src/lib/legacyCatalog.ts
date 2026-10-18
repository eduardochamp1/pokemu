import type { TypeName } from "../data/typeMatchups";
import type { Gym, GymMon } from "../data/gymLeaders";
import type { LegacySave } from "../emulator/saveParse/legacy";
import type { BattleMember } from "./gymGuide";

/**
 * Os dados de Gen 1 e Gen 2 como os jogos os definem: espécies, golpes,
 * tabela de tipos e times dos líderes.
 *
 * Saem das decompilações (pret/pokered, pret/pokeyellow, pret/pokecrystal)
 * por `npm run catalog:legacy`. Não dá para reaproveitar os de Gen 3: na
 * Gen 1 não havia Aço nem Sombrio, Fantasma não atingia Psíquico, Inseto e
 * Veneno se batiam, e Bite, Gust e Karate Chop eram do tipo Normal; o status
 * Especial era um só. Na Gen 2 a tabela já é a de hoje (sem Fada), mas o
 * poder de alguns golpes ainda era outro.
 */

/** [dex, slug, tipos, status base]. Gen 1: hp, atk, def, spe, special. Gen 2: hp, atk, def, spe, spa, spd. */
export type LegacySpecies = [dex: number, slug: string, types: string[], stats: number[]];
export type LegacyMove = [id: number, slug: string, type: string, power: number | null, accuracy: number, pp: number];
type RawGym = { leader: string; city: string; type: string; badge: string; party: [dex: number, level: number, moves: number[]][] };

export interface LegacyCatalog {
  generation: 1 | 2;
  species: LegacySpecies[];
  moves: LegacyMove[];
  /** [tipo do golpe, tipo do alvo, multiplicador]; o que não está aqui é 1. */
  chart: [string, string, number][];
  gyms: RawGym[] | { rb: RawGym[]; yellow: RawGym[] };
}

const cache: Partial<Record<1 | 2, Promise<LegacyCatalog>>> = {};

/** Carregado sob demanda: quem só joga Gen 3 nunca baixa. */
export function loadLegacyCatalog(generation: 1 | 2): Promise<LegacyCatalog> {
  cache[generation] ??= (
    generation === 1 ? import("../data/catalog/gen1.json") : import("../data/catalog/gen2.json")
  ).then((m) => m.default as unknown as LegacyCatalog);
  return cache[generation]!;
}

export type Multiplier = (moveType: TypeName, defenderTypes: TypeName[]) => number;

/** A tabela de tipos da geração como função, no formato que o guia usa. */
export function chartMultiplier(c: LegacyCatalog): Multiplier {
  const pares = new Map(c.chart.map(([a, d, m]) => [`${a}>${d}`, m]));
  return (moveType, defenderTypes) =>
    defenderTypes.reduce((mult, def) => mult * (pares.get(`${moveType}>${def}`) ?? 1), 1);
}

export type GymSet = "rb" | "yellow" | "gsc";

export function gymSetOf(save: Pick<LegacySave, "generation" | "game">): GymSet {
  return save.generation === 2 ? "gsc" : save.game === "yellow" ? "yellow" : "rb";
}

function rawGyms(c: LegacyCatalog, set: GymSet): RawGym[] {
  if (Array.isArray(c.gyms)) return c.gyms;
  return set === "yellow" ? c.gyms.yellow : c.gyms.rb;
}

export function legacyBadges(c: LegacyCatalog, set: GymSet): { name: string; leader: string; city: string }[] {
  return rawGyms(c, set).map((g) => ({ name: g.badge, leader: g.leader, city: g.city }));
}

/** Os ginásios com espécie, tipos e golpes resolvidos pelo catálogo da geração. */
export function legacyGyms(c: LegacyCatalog, set: GymSet): Gym[] {
  const especie = new Map(c.species.map((s) => [s[0], s]));
  const golpe = new Map(c.moves.map((m) => [m[0], m]));
  return rawGyms(c, set).map((g) => ({
    leader: g.leader,
    city: g.city,
    type: g.type as TypeName,
    party: g.party.flatMap(([dex, level, moves]): GymMon[] => {
      const s = especie.get(dex);
      if (!s) return [];
      return [
        {
          national: dex,
          species: s[1],
          level,
          // Treinador de Gen 1/2 não tem IV de 0–31: são DVs. Fica 0, como em FR/LG.
          iv: 0,
          types: s[2] as TypeName[],
          moves: moves.flatMap((id) => {
            const m = golpe.get(id);
            return m ? [{ slug: m[1], type: m[2] as TypeName, power: m[3] }] : [];
          }),
        },
      ];
    }),
  }));
}

/**
 * O time de um save de Gen 1 ou Gen 2 na forma que o guia de ginásios usa,
 * com os tipos e os golpes **daquela geração**. Ovo fica de fora: não luta.
 * Membro sem nível lido também: a análise usa o nível, e um nível inventado
 * (1, 0) daria um resultado que parece medido e não é.
 */
export function legacyBattleTeam(c: LegacyCatalog, save: LegacySave): BattleMember[] {
  if (save.generation !== c.generation) return [];
  const especie = new Map(c.species.map((s) => [s[0], s]));
  const golpe = new Map(c.moves.map((m) => [m[0], m]));
  return save.party.flatMap((mon): BattleMember[] => {
    if (mon.egg || mon.level === null) return [];
    const s = especie.get(mon.national);
    if (!s) return [];
    return [
      {
        name: mon.nickname,
        national: mon.national,
        level: mon.level,
        types: s[2] as TypeName[],
        moves: mon.moves.flatMap((mv) => {
          const g = golpe.get(mv.id);
          return g ? [{ slug: g[1], type: g[2] as TypeName, power: g[3] }] : [];
        }),
      },
    ];
  });
}
