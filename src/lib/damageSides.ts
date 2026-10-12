/**
 * Os dois lados da calculadora de dano, quando não vêm do save: status de uma
 * espécie num nível, e os golpes que ela aprende em Gen 3. Puro.
 */
import { expectedGen3Stats, type StatSpread } from "./gen3Stats";

/** Slug da PokéAPI -> chave de gen3Stats. */
const STAT: Record<string, keyof StatSpread> = {
  hp: "hp",
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

const ROMANOS: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
const geracao = (nome: string) => ROMANOS[nome.replace("generation-", "")] ?? 0;

/**
 * Os status base **da Gen 3**. A PokéAPI dá os de hoje, e trinta espécies das
 * primeiras gerações foram reforçadas depois — o Pikachu ganhou Defesa e
 * Defesa Especial na Gen 6. `past_stats` diz o valor que valia até cada
 * geração; para a Gen 3 vale a entrada da menor geração que seja 3 ou mais.
 * Conferido contra a decompilação: os 251 primeiros batem.
 */
export function baseStatsOf(p: {
  stats: { base_stat: number; stat: { name: string } }[];
  past_stats?: { generation: { name: string }; stats: { base_stat: number; stat: { name: string } }[] }[];
}): StatSpread | undefined {
  const out: Partial<StatSpread> = {};
  for (const s of p.stats) {
    const k = STAT[s.stat.name];
    if (k) out[k] = s.base_stat;
  }
  const antigos = (p.past_stats ?? [])
    .filter((e) => geracao(e.generation.name) >= 3)
    .sort((a, b) => geracao(b.generation.name) - geracao(a.generation.name));
  // Do mais recente para o mais antigo: o mais próximo da Gen 3 escreve por último.
  for (const e of antigos) {
    for (const s of e.stats) {
      const k = STAT[s.stat.name];
      if (k) out[k] = s.base_stat;
    }
  }
  return Object.keys(out).length === 6 ? (out as StatSpread) : undefined;
}

const IV_31: StatSpread = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };
const EV_0: StatSpread = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

/**
 * Status de uma espécie sem save: IVs no máximo, sem EVs, natureza neutra
 * (Hardy). É a suposição mais comum em calculadora — e fica dita na tela.
 */
export function genericStats(base: StatSpread, level: number): StatSpread & { maxHp: number } {
  const s = expectedGen3Stats(base, IV_31, EV_0, level, 0);
  return { ...s, maxHp: s.hp };
}

const GRUPOS_DA_GEN_3 = new Set(["ruby-sapphire", "emerald", "firered-leafgreen", "colosseum", "xd"]);

export function gen3Learnset(p: {
  moves: { move: { name: string }; version_group_details: { version_group: { name: string } }[] }[];
}): string[] {
  return p.moves
    .filter((m) => m.version_group_details.some((d) => GRUPOS_DA_GEN_3.has(d.version_group.name)))
    .map((m) => m.move.name)
    .sort();
}
