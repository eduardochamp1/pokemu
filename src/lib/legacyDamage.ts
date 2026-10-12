import type { LegacyCatalog } from "./legacyCatalog";

/**
 * Dano como a Gen 1 e a Gen 2 calculam, seguindo as decompilações
 * (pret/pokered `CalculateDamage` e `AdjustDamageForMoveType`; pret/pokecrystal
 * `BattleCommand_DamageCalc`, `BattleCommand_Stab` e
 * `BattleCommand_DamageVariation`). Tudo em inteiros, arredondando para baixo
 * a cada passo, na ordem do jogo.
 *
 * O que as duas gerações têm de diferente da Gen 3, e que muda o resultado:
 *  - físico ou especial é do **tipo** do golpe; na Gen 1 o Especial é um status
 *    só, usado para atacar e para defender;
 *  - o acerto crítico da Gen 1 **dobra o nível** na fórmula; o da Gen 2 dobra o
 *    dano antes do `+2`;
 *  - se o ataque ou a defesa passa de 255, os dois são divididos por 4;
 *  - a rolagem vai de 217 a 255 sobre 255 (39 valores), não de 85% a 100%.
 *
 * Fica de fora: estágios de status, itens, bônus de insígnia e os golpes de
 * dano fixo ou especial (Seismic Toss, Dragon Rage, OHKO), que não usam esta
 * fórmula.
 */

/** Tipos que usam o status Especial. Sombrio só existe na Gen 2. */
const ESPECIAIS = new Set(["fire", "water", "grass", "electric", "ice", "psychic", "dragon", "dark"]);
export const isSpecialType = (type: string) => ESPECIAIS.has(type);

export interface LegacyDamageInput {
  generation: 1 | 2;
  level: number;
  /** Ataque ou Especial/Ataque Especial, conforme o tipo do golpe. */
  attack: number;
  /** Defesa ou Especial/Defesa Especial do alvo. */
  defense: number;
  power: number;
  moveType: string;
  moveSlug?: string;
  attackerTypes: readonly string[];
  defenderTypes: readonly string[];
  chart: LegacyCatalog["chart"];
  crit?: boolean;
  /** Atacante queimado: metade do Ataque em golpe físico. */
  burned?: boolean;
  /** Reflect (físico) ou Light Screen (especial) do lado do alvo: dobra a defesa. */
  screen?: boolean;
  /** Só Gen 2. */
  weather?: "none" | "rain" | "sun";
}

export interface LegacyDamageResult {
  /** As 39 rolagens, de 217/255 a 255/255. */
  rolls: number[];
  min: number;
  max: number;
  effectiveness: number;
}

const AUTODESTRUICAO = new Set(["self-destruct", "explosion"]);

export function calcLegacyDamage(i: LegacyDamageInput): LegacyDamageResult {
  const fisico = !isSpecialType(i.moveType);
  let atk = i.attack;
  let def = i.defense;

  // Crítico ignora queimadura e telas nas duas gerações (usa o status cru).
  if (!i.crit) {
    if (fisico && i.burned) atk = Math.max(1, Math.floor(atk / 2));
    if (i.screen) def *= 2;
  }
  // Os status cabem num byte na conta: passou de 255, os dois caem para um quarto.
  if (atk > 255 || def > 255) {
    atk = Math.max(1, Math.floor(atk / 4));
    def = Math.max(1, Math.floor(def / 4));
  }
  // Selfdestruct e Explosion partem a defesa do alvo ao meio — depois da
  // redução acima, que é a ordem das duas rotinas.
  if (i.moveSlug && AUTODESTRUICAO.has(i.moveSlug)) def = Math.max(1, Math.floor(def / 2));

  const nivel = i.generation === 1 && i.crit ? i.level * 2 : i.level;
  let dano = Math.floor(Math.floor((Math.floor((2 * nivel) / 5) + 2) * i.power * atk / def) / 50);
  if (i.generation === 2 && i.crit) dano *= 2;
  dano = Math.min(dano, 997) + 2;

  if (i.generation === 2 && i.weather && i.weather !== "none") {
    const favorece = (i.weather === "rain" && i.moveType === "water") || (i.weather === "sun" && i.moveType === "fire");
    const atrapalha = (i.weather === "rain" && i.moveType === "fire") || (i.weather === "sun" && i.moveType === "water");
    if (favorece) dano = Math.floor((dano * 3) / 2);
    if (atrapalha) dano = Math.floor(dano / 2);
  }

  if (i.attackerTypes.includes(i.moveType)) dano += Math.floor(dano / 2);

  // Um tipo do alvo por vez, na ordem da tabela, arredondando a cada passo.
  let efetividade = 1;
  for (const [atacante, alvo, mult] of i.chart) {
    if (atacante !== i.moveType || !i.defenderTypes.includes(alvo)) continue;
    efetividade *= mult;
    dano = Math.floor((dano * mult * 10) / 10);
  }
  if (efetividade === 0) return { rolls: Array(39).fill(0), min: 0, max: 0, effectiveness: 0 };
  // Na Gen 2 um golpe que acerta nunca dá menos que 1.
  if (i.generation === 2) dano = Math.max(1, dano);

  const rolls: number[] = [];
  for (let r = 217; r <= 255; r++) rolls.push(dano > 1 ? Math.floor((dano * r) / 255) : dano);
  return { rolls, min: rolls[0], max: rolls[rolls.length - 1], effectiveness: efetividade };
}

export interface LegacyStats {
  hp: number;
  atk: number;
  def: number;
  spe: number;
  /** Gen 1: o Especial único nos dois campos. */
  spa: number;
  spd: number;
}

/**
 * Os status de uma espécie num nível, pela fórmula das duas gerações:
 * `((base + DV) × 2 + ⌊⌈√exp⌉ / 4⌋) × nível / 100 + 5` (HP: `+ nível + 10`).
 * O DV de HP não é guardado: sai do bit menos significativo dos outros quatro.
 *
 * `dv` vale para ataque, defesa, velocidade e especial; `statExp` é a
 * experiência de status, igual nos cinco.
 */
export function legacyStatsFor(base: readonly number[], level: number, dv: number, statExp = 0): LegacyStats {
  const bonus = Math.floor(Math.min(255, Math.ceil(Math.sqrt(statExp))) / 4);
  const stat = (b: number, d: number) => Math.floor(((b + d) * 2 + bonus) * level / 100) + 5;
  const dvHp = (dv & 1) * 8 + (dv & 1) * 4 + (dv & 1) * 2 + (dv & 1);
  const [hp, atk, def, spe, spa, spd = spa] = base;
  return {
    hp: Math.floor(((hp + dvHp) * 2 + bonus) * level / 100) + level + 10,
    atk: stat(atk, dv),
    def: stat(def, dv),
    spe: stat(spe, dv),
    spa: stat(spa, dv),
    spd: stat(spd, dv),
  };
}

/** Quantos golpes para derrubar `hp`. `null` quando o golpe não causa dano. */
export function legacyHitsToKo(r: { min: number; max: number }, hp: number): { hits: number; guaranteed: boolean } | null {
  if (r.max <= 0) return null;
  const peloMax = Math.ceil(hp / r.max);
  const peloMin = r.min > 0 ? Math.ceil(hp / r.min) : Infinity;
  return { hits: peloMax, guaranteed: peloMin === peloMax };
}
