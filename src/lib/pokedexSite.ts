/**
 * A Pokédex é outro site.
 *
 * O emulador nasceu como uma aba dela e saiu para um projeto próprio. As fichas,
 * o mapa e a lore continuam lá — daqui só dá para apontar. O endereço vem de
 * `VITE_POKEDEX_URL` (ver `.env.example`); sem ele os links viram texto, em vez
 * de apontar para um lugar que não existe.
 */
export function pokedexBase(raw: string | undefined): string | null {
  const url = raw?.trim().replace(/\/+$/, "");
  return url && /^https?:\/\//.test(url) ? url : null;
}

const BASE = pokedexBase(import.meta.env.VITE_POKEDEX_URL as string | undefined);

/** Endereço de uma página da Pokédex, ou null se o site não foi configurado. */
export function pokedexUrl(path: string, base: string | null = BASE): string | null {
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : null;
}

export const temPokedex = BASE !== null;
