/**
 * O seu time contra o time de um líder de ginásio, golpe a golpe. Puro: os
 * tipos e golpes de Gen 3 já chegam resolvidos (os do líder vêm prontos em
 * `data/gymLeaders`, os seus a página busca na PokéAPI).
 */
import type { TypeName } from "../data/typeMatchups";
import type { Gym, GymMon, GymMove } from "../data/gymLeaders";
import { gen3TypeMultiplier } from "./gen3Damage";

export interface BattleMember {
  name: string;
  national: number;
  level: number;
  types: TypeName[];
  moves: GymMove[];
}

export interface Matchup {
  /** O melhor multiplicador de um golpe de dano seu. `null`: nenhum golpe de dano. */
  offense: { mult: number | null; move?: string };
  /** O pior multiplicador de um golpe de dano dele contra você. */
  defense: { mult: number | null; move?: string };
}

const deDano = (moves: GymMove[]) => moves.filter((m) => m.power !== null && m.power > 0);

/** A tabela de tipos em uso. O padrão é a da Gen 3; Gen 1 e Gen 2 passam a delas. */
export type TypeChart = (moveType: TypeName, defenderTypes: TypeName[]) => number;

function melhor(moves: GymMove[], alvo: TypeName[], chart: TypeChart): { mult: number | null; move?: string } {
  let out: { mult: number | null; move?: string } = { mult: null };
  for (const m of deDano(moves)) {
    const mult = chart(m.type, alvo);
    if (out.mult === null || mult > out.mult) out = { mult, move: m.slug };
  }
  return out;
}

export function matchup(member: BattleMember, mon: GymMon, chart: TypeChart = gen3TypeMultiplier): Matchup {
  return { offense: melhor(member.moves, mon.types, chart), defense: melhor(mon.moves, member.types, chart) };
}

export interface GymRank {
  member: BattleMember;
  score: number;
  matchups: Matchup[];
}

/**
 * Quem levar: somatório, pokémon a pokémon do líder, de quanto você bate e de
 * quanto apanha. Só tipos — nível e status ficam para a calculadora de dano.
 */
export function rankForGym(team: BattleMember[], gym: Gym, chart: TypeChart = gen3TypeMultiplier): GymRank[] {
  return team
    .map((member) => {
      const matchups = gym.party.map((mon) => matchup(member, mon, chart));
      let score = 0;
      for (const { offense, defense } of matchups) {
        const o = offense.mult;
        if (o !== null) score += o >= 4 ? 3 : o >= 2 ? 2 : o === 0 ? -2 : o < 1 ? -1 : 0;
        const d = defense.mult;
        if (d !== null) score += d >= 4 ? -3 : d >= 2 ? -2 : d === 0 ? 2 : d < 1 ? 1 : 0;
      }
      return { member, score, matchups };
    })
    .sort((a, b) => b.score - a.score);
}

/** Índice do primeiro ginásio sem insígnia; `null` com as oito. */
export function nextGym(badges: boolean[] | null): number | null {
  if (!badges) return 0;
  const i = badges.findIndex((b) => !b);
  return i < 0 ? null : i;
}

export interface GymScenario {
  /** Posição do membro no time, que é como a calculadora o seleciona. */
  attackerIndex: number;
  attacker: string;
  defender: GymMon;
  /** O multiplicador do melhor golpe dele contra este pokémon. */
  mult: number | null;
}

export interface GymPrep {
  /** Para cada pokémon do líder, quem do time bate melhor nele. */
  scenarios: GymScenario[];
  /** Os pokémon do líder que ninguém do time atinge com vantagem. */
  uncovered: GymMon[];
  /** O maior nível do líder e o maior do time. */
  aceLevel: number;
  topLevel: number;
}

/**
 * O que olhar antes do próximo líder: quem bate melhor em cada pokémon dele,
 * onde o time não tem resposta e a diferença de nível.
 *
 * Continua sendo leitura de tipos. Cada cenário é o ponto de partida para a
 * calculadora, que é quem diz se o golpe derruba.
 */
export function prepareForGym(team: BattleMember[], gym: Gym, chart: TypeChart = gen3TypeMultiplier): GymPrep {
  const scenarios: GymScenario[] = [];
  const uncovered: GymMon[] = [];
  for (const mon of gym.party) {
    let melhorIndice = -1;
    let melhorMult: number | null = null;
    team.forEach((member, i) => {
      const m = matchup(member, mon, chart).offense.mult;
      if (m === null) return;
      const atual = melhorIndice < 0 ? undefined : team[melhorIndice];
      // Empate no tipo: vale o de nível mais alto.
      if (melhorMult === null || m > melhorMult || (m === melhorMult && atual && member.level > atual.level)) {
        melhorMult = m;
        melhorIndice = i;
      }
    });
    if (melhorIndice >= 0) {
      scenarios.push({ attackerIndex: melhorIndice, attacker: team[melhorIndice].name, defender: mon, mult: melhorMult });
    }
    if (melhorMult === null || melhorMult <= 1) uncovered.push(mon);
  }
  return {
    scenarios,
    uncovered,
    aceLevel: Math.max(0, ...gym.party.map((m) => m.level)),
    topLevel: Math.max(0, ...team.map((m) => m.level)),
  };
}
