import type { LegacySave } from "../emulator/saveParse/legacy";

/**
 * Dois saves de Gen 1 ou Gen 2 lado a lado. Puro.
 *
 * Mesma ideia de `compareSaves` (que é de Gen 3), com o que essas gerações
 * guardam: sem conquistas e sem natureza. Dá para comparar um jogo de Gen 1
 * com um de Gen 2 — a diferença de dex é pelos números nacionais, que são os
 * mesmos — mas as insígnias viram "não se compara": são 8 num e 16 no outro.
 */

export type LegacyRowKey = "owned" | "seen" | "badges" | "topLevel" | "pc" | "time" | "money";

export interface LegacyRow {
  key: LegacyRowKey;
  a: number | null;
  b: number | null;
  ahead: "a" | "b" | null;
}

export interface LegacyComparison {
  rows: LegacyRow[];
  onlyA: number[];
  onlyB: number[];
  both: number[];
}

const niveis = (s: LegacySave) => s.party.flatMap((m) => (m.egg || m.level === null ? [] : [m.level]));

const valores: Record<LegacyRowKey, (s: LegacySave) => number | null> = {
  owned: (s) => s.pokedex.owned.length,
  seen: (s) => s.pokedex.seen.length,
  badges: (s) => s.trainer.badges.filter(Boolean).length,
  topLevel: (s) => (niveis(s).length ? Math.max(...niveis(s)) : null),
  // Caixa que não pôde ser lida vem `null`: não conta como vazia.
  pc: (s) => (s.boxes.boxes.some((b) => b.pokemon === null) ? null : s.boxes.boxes.reduce((n, b) => n + (b.pokemon?.length ?? 0), 0)),
  time: (s) => s.trainer.playTime.hours * 3600 + s.trainer.playTime.minutes * 60 + s.trainer.playTime.seconds,
  money: (s) => s.trainer.money,
};

const ORDEM: LegacyRowKey[] = ["owned", "seen", "badges", "topLevel", "pc", "time", "money"];

export function compareLegacy(a: LegacySave, b: LegacySave): LegacyComparison {
  const mesmaGeracao = a.generation === b.generation;
  const rows = ORDEM.map((key): LegacyRow => {
    const va = valores[key](a);
    const vb = valores[key](b);
    // Insígnias entre gerações: 8 de 8 não é "menos" que 9 de 16.
    const comparavel = va !== null && vb !== null && (key !== "badges" || mesmaGeracao);
    const ahead = !comparavel || va === vb ? null : va! > vb! ? "a" : "b";
    return { key, a: va, b: vb, ahead };
  });
  const sa = new Set(a.pokedex.owned);
  const sb = new Set(b.pokedex.owned);
  const num = (x: number, y: number) => x - y;
  return {
    rows,
    onlyA: [...sa].filter((n) => !sb.has(n)).sort(num),
    onlyB: [...sb].filter((n) => !sa.has(n)).sort(num),
    both: [...sa].filter((n) => sb.has(n)).sort(num),
  };
}
