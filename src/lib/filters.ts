/**
 * Logica pura de indice, busca e interseccao de filtros.
 * Sem React e sem fetch — testavel isoladamente.
 */

/** Extrai o id numerico de uma URL da PokeAPI ("/pokemon/25/" -> 25). */
export function extractIdFromUrl(url: string): number | undefined {
  const m = url.match(/\/(\d+)\/?$/);
  return m ? Number(m[1]) : undefined;
}

/** Monta o mapa nome -> id a partir de qualquer lista de recursos da PokeAPI. */
export function buildNameIndex(
  results: { name: string; url: string }[]
): Map<string, number> {
  const index = new Map<string, number>();
  for (const r of results) {
    const id = extractIdFromUrl(r.url);
    if (id !== undefined) index.set(r.name, id);
  }
  return index;
}

/**
 * Ids da Pokedex -> nomes do indice, na ordem dos ids. Serve para quem so tem
 * numeros nacionais, como a dex lida do save. Id desconhecido fica de fora.
 */
export function namesForIds(ids: number[], index: Map<string, number>): string[] {
  const nomePorId = new Map<number, string>();
  for (const [name, id] of index) if (!nomePorId.has(id)) nomePorId.set(id, name);
  return ids.flatMap((id) => {
    const name = nomePorId.get(id);
    return name === undefined ? [] : [name];
  });
}
