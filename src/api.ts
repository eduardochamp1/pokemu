import type {
  Pokemon,
  PokemonListResponse,
} from "./types/pokemon";

const BASE_URL = "https://pokeapi.co/api/v2";

// Alguns nomes canonicos nao respondem no endpoint /pokemon/ — a API so
// tem a forma default especifica (ex: "giratina-altered" em vez de "giratina").
// Este mapa traduz o nome amigavel para o slug que a API aceita.
// As chaves precisam estar em minusculas: resolveName() faz toLowerCase antes
// de consultar o mapa.
const POKEMON_ALIAS: Record<string, string> = {
  giratina: "giratina-altered",
  urshifu: "urshifu-single-strike",
  shaymin: "shaymin-land",
  deoxys: "deoxys-normal",
  tornadus: "tornadus-incarnate",
  thundurus: "thundurus-incarnate",
  landorus: "landorus-incarnate",
  enamorus: "enamorus-incarnate",
  meloetta: "meloetta-aria",
  keldeo: "keldeo-ordinary",
  basculin: "basculin-red-striped",
  meowstic: "meowstic-male",
  // A API so serve a forma default com sufixo para estes — o nome seco nao
  // responde. Sem alias o chip da lore fica sem sprite E a especie some do
  // filtro por geracao: a Gen 9 mostrava 114 de 120 por causa dos seis daqui.
  frillish: "frillish-male",
  jellicent: "jellicent-male",
  pyroar: "pyroar-male",
  basculegion: "basculegion-male",
  oinkologne: "oinkologne-male",
  maushold: "maushold-family-of-four",
  squawkabilly: "squawkabilly-green-plumage",
  palafin: "palafin-zero",
  tatsugiri: "tatsugiri-curly",
  dudunsparce: "dudunsparce-two-segment",
  aegislash: "aegislash-shield",
  pumpkaboo: "pumpkaboo-average",
  gourgeist: "gourgeist-average",
  oricorio: "oricorio-baile",
  lycanroc: "lycanroc-midday",
  wishiwashi: "wishiwashi-solo",
  minior: "minior-red-meteor",
  mimikyu: "mimikyu-disguised",
  toxtricity: "toxtricity-amped",
  eiscue: "eiscue-ice",
  indeedee: "indeedee-male",
  morpeko: "morpeko-full-belly",
  zygarde: "zygarde-50",
  wormadam: "wormadam-plant",
  darmanitan: "darmanitan-standard",
};

export function resolveName(name: string): string {
  const lower = name.toLowerCase().trim();
  return POKEMON_ALIAS[lower] ?? lower;
}

/** Caminho de volta: slug servido pela API -> nome pelo qual a especie e conhecida. */
const NOME_DA_ESPECIE: Record<string, string> = Object.fromEntries(
  Object.entries(POKEMON_ALIAS).map(([especie, slug]) => [slug, especie])
);

/**
 * Nome para mostrar na tela.
 *
 * Trinta e sete especies so existem no endpoint /pokemon com o sufixo da
 * forma default, e o alias acima traduz isso na ida. Na volta, sem esta
 * funcao, a carta escrevia "giratina-altered", "deoxys-normal" e
 * "maushold-family-of-four" — o slug do banco, nao o nome da criatura.
 *
 * So desfaz o que o alias fez: forma que e de fato distinta, como
 * "charizard-mega-x", passa intacta.
 */
export function displayName(apiName: string): string {
  return NOME_DA_ESPECIE[apiName.toLowerCase().trim()] ?? apiName;
}

/**
 * Retorna null apenas para 404 (recurso inexistente). Qualquer outra falha
 * — rede fora, 5xx, JSON invalido — propaga, para que a UI possa distinguir
 * "nao existe" de "nao deu para consultar".
 */
/** Quanto esperar a PokéAPI antes de desistir: rede lenta não pode deixar a tela carregando para sempre. */
export const FETCH_TIMEOUT_MS = 15_000;

/** Junta o sinal de quem chamou com o tempo-limite. */
function comTempoLimite(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const limite = AbortSignal.timeout(ms);
  if (!signal) return limite;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, limite]);
  const ctl = new AbortController();
  const abortar = (s: AbortSignal) => () => ctl.abort(s.reason);
  signal.addEventListener("abort", abortar(signal), { once: true });
  limite.addEventListener("abort", abortar(limite), { once: true });
  return ctl.signal;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const response = await fetch(url, { signal: comTempoLimite(signal, FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export const fetchJsonPublic = fetchJson;

export const searchPokemon = async (
  pokemon: string,
  signal?: AbortSignal
): Promise<Pokemon | null> => {
  return fetchJson<Pokemon>(
    `${BASE_URL}/pokemon/${resolveName(pokemon)}`,
    signal
  );
};

/**
 * Indice completo de nomes -> id (1 request, ~90 kB).
 */
export const getPokemonIndex = async (
  signal?: AbortSignal
): Promise<PokemonListResponse> => {
  const data = await fetchJson<PokemonListResponse>(
    `${BASE_URL}/pokemon?limit=100000&offset=0`,
    signal
  );
  if (!data) throw new Error("Pokemon index unavailable");
  return data;
};
