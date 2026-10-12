import type { MoveDetail, Pokemon } from "../types/pokemon";

/**
 * O essencial da 3ª geração, embarcado no site.
 *
 * O time, a calculadora de dano e os ginásios pediam tudo à PokéAPI. Sem rede
 * e sem cache de uma visita anterior, a ficha do save abria com números e sem
 * nomes, e a calculadora não calculava. O catálogo (`data/catalog/gen3.json`,
 * gerado por `npm run catalog`) cobre as 386 espécies e os 354 golpes que um
 * save de Gen 3 pode conter.
 *
 * É o plano B: com rede o site continua lendo a PokéAPI, que tem artwork e a
 * lista completa de golpes por jogo. Os objetos devolvidos aqui têm a forma
 * da PokéAPI, já com os valores de Gen 3 nos campos "de hoje" e sem os
 * `past_*` — então `gen3PokemonTypes`, `gen3MoveData` e `gen3Abilities`
 * devolvem o mesmo resultado para os dois.
 */

type SpeciesRow = [id: number, name: string, types: string[], stats: number[], abilities: string[], learnset: number[]];
type MoveRow = [
  id: number,
  name: string,
  type: string,
  power: number | null,
  accuracy: number | null,
  pp: number | null,
  priority: number,
  damageClass: string,
];

export interface Catalog {
  source: string;
  generatedAt: string;
  generation: number;
  species: SpeciesRow[];
  moves: MoveRow[];
}

let promise: Promise<Catalog> | undefined;

/** Carregado sob demanda: são ~110 kB que quem está online nunca baixa. */
export function loadCatalog(): Promise<Catalog> {
  promise ??= import("../data/catalog/gen3.json").then((m) => m.default as unknown as Catalog);
  return promise;
}

const ref = (name: string) => ({ name, url: "" });
const STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

export function pokemonFromCatalog(c: Catalog, key: string | number): Pokemon | null {
  const k = String(key).toLowerCase();
  const row = c.species.find((s) => String(s[0]) === k || s[1] === k);
  if (!row) return null;
  const [id, name, types, stats, abilities, learnset] = row;
  const nomeDoGolpe = new Map(c.moves.map((m) => [m[0], m[1]]));
  return {
    id,
    name,
    sprites: { front_default: null, front_shiny: null, back_default: null, back_shiny: null },
    types: types.map((t, i) => ({ slot: i + 1, type: ref(t) })),
    stats: stats.map((base_stat, i) => ({ base_stat, effort: 0, stat: ref(STATS[i]) })),
    abilities: abilities.map((a, i) => ({ is_hidden: false, slot: i + 1, ability: ref(a) })),
    height: 0,
    weight: 0,
    species: ref(name),
    base_experience: null,
    // Um grupo de versões basta: quem lê só pergunta "aprende em Gen 3?".
    moves: learnset.flatMap((moveId) => {
      const moveName = nomeDoGolpe.get(moveId);
      if (!moveName) return [];
      return [
        {
          move: { name: moveName, url: `https://pokeapi.co/api/v2/move/${moveId}/` },
          version_group_details: [
            { level_learned_at: 0, version_group: ref("emerald"), move_learn_method: ref("level-up") },
          ],
        },
      ];
    }),
  };
}

export function moveFromCatalog(c: Catalog, key: string | number): MoveDetail | null {
  const k = String(key).toLowerCase();
  const row = c.moves.find((m) => String(m[0]) === k || m[1] === k);
  if (!row) return null;
  const [id, name, type, power, accuracy, pp, priority, damageClass] = row;
  return {
    id,
    name,
    accuracy,
    power,
    pp,
    priority,
    type: ref(type),
    damage_class: ref(damageClass),
    flavor_text_entries: [],
    names: [],
  };
}

/** A lista de nomes, na forma de `/pokemon?limit=`: só as 386. */
export function indexFromCatalog(c: Catalog): { name: string; url: string }[] {
  return c.species.map((s) => ({ name: s[1], url: `https://pokeapi.co/api/v2/pokemon/${s[0]}/` }));
}

/**
 * Tenta a rede; se ela falhar, o catálogo. `null` da rede (404) é resposta, e
 * não falha: um nome que a API diz não existir não vira outra coisa.
 *
 * Se o catálogo também não tem, sobe o erro original — a tela precisa
 * distinguir "não deu para consultar" de "não existe".
 */
export async function withCatalogFallback<T>(
  network: () => Promise<T>,
  fromCatalog: (c: Catalog) => T | null
): Promise<T> {
  try {
    return await network();
  } catch (error) {
    // Pedido cancelado não é "sem rede": quem cancelou não quer resposta.
    if (error instanceof Error && error.name === "AbortError") throw error;
    const local = await loadCatalog()
      .then(fromCatalog)
      .catch(() => null);
    if (local === null) throw error;
    return local;
  }
}
