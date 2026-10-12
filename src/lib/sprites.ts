/**
 * Sprites servidos pelo proprio projeto, de `public/sprites/`.
 *
 * Baixados uma vez por `npm run sprites` (scripts/fetch-sprites.mjs) e
 * commitados junto do codigo: os 1.351 sprites pixelados somam ~1,6 MB. Como
 * o caminho e deterministico (id do pokemon), renderizar as caixas inteiras
 * do PC custa zero request de API.
 *
 * O artwork grande (475px, ~133 kB cada) NAO fica no repo — 1.351 arquivos
 * dariam ~176 MB. Ele continua vindo do objeto `Pokemon` que a PokeAPI ja
 * devolve nas telas que buscam o detalhe.
 */
const POKEMON_SPRITES = "/sprites/pokemon";

/**
 * Sprite pixelado local de um pokemon, por id da Pokedex. Usado nas
 * miniaturas — onde 96px basta e o artwork seria desperdicio de banda.
 */
export function pixelSpriteUrl(id: number | undefined): string {
  if (id === undefined) return "";
  return `${POKEMON_SPRITES}/${id}.png`;
}
