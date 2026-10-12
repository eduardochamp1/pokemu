import type { TypeName } from "../data/typeMatchups";
import { gen3TypeMultiplier } from "./gen3Damage";
import type { Catalog } from "./offlineCatalog";

/**
 * Laboratório do time: o que os tipos dizem sobre o time do save.
 *
 * Três perguntas — de que o time apanha junto, o que ele não consegue atingir
 * bem, e quem do PC ajudaria. Tudo pela tabela de tipos da Gen 3: é uma
 * leitura do time, não uma simulação de batalha. Não considera níveis, status,
 * habilidades nem itens, e a tela diz isso.
 */

export interface LabMove {
  name: string;
  type: TypeName;
  /** `null` = golpe de status, que não entra na cobertura. */
  power: number | null;
}

export interface LabMon {
  name: string;
  national: number;
  types: TypeName[];
  moves: LabMove[];
}

/** Os 17 tipos que existiam na Gen 3 (sem Fada). */
export const GEN3_TYPES: TypeName[] = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel",
];

export interface DefenseRow {
  type: TypeName;
  weak: string[];
  resist: string[];
  immune: string[];
}

/** Para cada tipo de ataque, quem do time é fraco, resiste ou é imune. */
export function defensiveTable(team: readonly LabMon[]): DefenseRow[] {
  return GEN3_TYPES.map((type) => {
    const row: DefenseRow = { type, weak: [], resist: [], immune: [] };
    for (const mon of team) {
      const m = gen3TypeMultiplier(type, mon.types);
      if (m === 0) row.immune.push(mon.name);
      else if (m > 1) row.weak.push(mon.name);
      else if (m < 1) row.resist.push(mon.name);
    }
    return row;
  });
}

/**
 * As fraquezas que o time divide: o tipo derruba metade do time ou mais, ou
 * derruba dois e ninguém segura. Um time de dois não tem "fraqueza
 * compartilhada" por ter um membro fraco.
 */
export function sharedWeaknesses(table: readonly DefenseRow[], teamSize: number): DefenseRow[] {
  return table
    .filter((r) => {
      const seguram = r.resist.length + r.immune.length;
      return r.weak.length >= Math.max(2, Math.ceil(teamSize / 2)) || (r.weak.length >= 2 && seguram === 0);
    })
    .sort((a, b) => b.weak.length - a.weak.length);
}

export interface CoverageGap {
  type: TypeName;
  /** O melhor multiplicador que algum golpe de dano do time consegue. */
  best: number;
}

/**
 * Os tipos que o time não atinge com super efetividade com nenhum golpe de
 * dano que tem. Considera um alvo de tipo único: é o piso da cobertura.
 */
export function coverageGaps(team: readonly LabMon[]): CoverageGap[] {
  const golpes = team.flatMap((m) => m.moves).filter((g) => g.power !== null && g.power > 0);
  if (golpes.length === 0) return [];
  return GEN3_TYPES.map((type) => ({
    type,
    best: Math.max(...golpes.map((g) => gen3TypeMultiplier(g.type, [type]))),
  }))
    .filter((g) => g.best <= 1)
    .sort((a, b) => a.best - b.best);
}

export interface Suggestion {
  mon: LabMon;
  /** Fraquezas compartilhadas que este pokémon resiste ou ignora. */
  covers: TypeName[];
  /** Fraquezas compartilhadas de que ele também sofre. */
  alsoWeak: TypeName[];
}

/**
 * Quem do PC seguraria o que o time não segura.
 *
 * Só entra quem cobre mais do que piora, e cada sugestão carrega o motivo —
 * "resiste a Água e Gelo" — em vez de uma nota. Uma espécie aparece uma vez.
 */
export function suggestFromBox(
  box: readonly LabMon[],
  shared: readonly DefenseRow[],
  team: readonly LabMon[],
  limit = 5
): Suggestion[] {
  if (shared.length === 0) return [];
  const noTime = new Set(team.map((m) => m.national));
  const vistos = new Set<number>();
  const out: Suggestion[] = [];
  for (const mon of box) {
    if (noTime.has(mon.national) || vistos.has(mon.national)) continue;
    vistos.add(mon.national);
    const covers: TypeName[] = [];
    const alsoWeak: TypeName[] = [];
    for (const row of shared) {
      const m = gen3TypeMultiplier(row.type, mon.types);
      if (m < 1) covers.push(row.type);
      else if (m > 1) alsoWeak.push(row.type);
    }
    if (covers.length > alsoWeak.length) out.push({ mon, covers, alsoWeak });
  }
  return out
    .sort((a, b) => b.covers.length - a.covers.length || a.alsoWeak.length - b.alsoWeak.length || a.mon.national - b.mon.national)
    .slice(0, limit);
}

/** Monta um `LabMon` do catálogo: tipos da espécie e golpes pelos números do save. */
export function labMonFromCatalog(
  c: Catalog,
  national: number,
  name: string,
  moveIds: readonly number[]
): LabMon | null {
  const especie = c.species.find((s) => s[0] === national);
  if (!especie) return null;
  const moves = moveIds.flatMap((id) => {
    const g = c.moves.find((m) => m[0] === id);
    return g ? [{ name: g[1], type: g[2] as TypeName, power: g[3] }] : [];
  });
  return { name, national, types: especie[2] as TypeName[], moves };
}
