import { useCallback } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchJsonPublic,
  getPokemonIndex,
  resolveName,
  searchPokemon,
} from "../api";
import { buildNameIndex } from "../lib/filters";
import {
  indexFromCatalog,
  moveFromCatalog,
  pokemonFromCatalog,
  withCatalogFallback,
} from "../lib/offlineCatalog";
import type { MoveDetail, Pokemon } from "../types/pokemon";

const HOUR = 60 * 60 * 1000;

/** A espécie pela PokéAPI; sem rede, pelo catálogo embarcado (Gen 3). */
function pokemonOuCatalogo(nameOrId: string, signal?: AbortSignal): Promise<Pokemon | null> {
  return withCatalogFallback(
    () => searchPokemon(nameOrId, signal),
    (c) => pokemonFromCatalog(c, resolveName(nameOrId))
  );
}

/** O golpe pela PokéAPI (nome ou número); sem rede, pelo catálogo. */
function golpeOuCatalogo(nameOrId: string, signal?: AbortSignal): Promise<MoveDetail | null> {
  return withCatalogFallback(
    () => fetchJsonPublic<MoveDetail>(`https://pokeapi.co/api/v2/move/${nameOrId}`, signal),
    (c) => moveFromCatalog(c, nameOrId)
  );
}

/** Indice completo nome -> id. Um request, cacheado por uma hora. */
export function usePokemonIndex() {
  const query = useQuery({
    queryKey: ["pokemon-index"],
    // Sem rede o índice vem do catálogo: só as 386 de Gen 3, que é o que um
    // save pode conter.
    queryFn: async ({ signal }) =>
      buildNameIndex(
        await withCatalogFallback(async () => (await getPokemonIndex(signal)).results, indexFromCatalog)
      ),
    staleTime: HOUR,
    gcTime: HOUR,
  });
  const index = query.data;

  /**
   * Id da Pokedex para um nome. Passa por resolveName porque o indice guarda
   * o slug da API ("giratina-altered", "deoxys-normal"), nao o nome amigavel.
   */
  const idOf = useCallback(
    (name: string) => index?.get(resolveName(name)),
    [index]
  );

  return {
    index,
    idOf,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function usePokemonDetail(nameOrId: string | undefined) {
  return useQuery<Pokemon | null>({
    queryKey: ["pokemon-detail", nameOrId ? resolveName(nameOrId) : undefined],
    queryFn: ({ signal }) => pokemonOuCatalogo(nameOrId!, signal),
    enabled: Boolean(nameOrId),
    staleTime: 30 * 60 * 1000,
  });
}

export function usePokemonsByNames(names: string[]) {
  const queries = useQueries({
    queries: names.map((name) => ({
      queryKey: ["pokemon-detail", resolveName(name)],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        pokemonOuCatalogo(name, signal),
      staleTime: 30 * 60 * 1000,
    })),
  });
  return {
    pokemons: queries
      .map((q) => q.data)
      .filter((p): p is Pokemon => Boolean(p)),
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

/** Detalhe de um golpe (poder, tipo, precisão), buscado só quando pedido. */
export function useMoveDetail(moveName: string | undefined) {
  return useQuery<MoveDetail | null>({
    queryKey: ["move-detail", moveName],
    queryFn: ({ signal }) => golpeOuCatalogo(moveName!, signal),
    enabled: Boolean(moveName),
    staleTime: HOUR,
  });
}

/** Vários golpes de uma vez, com a chave de cache de `useMoveDetail`. */
export function useMoveDetails(moveNames: string[]): Record<string, MoveDetail | null | undefined> {
  const results = useQueries({
    queries: moveNames.map((moveName) => ({
      queryKey: ["move-detail", moveName],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        golpeOuCatalogo(moveName, signal),
      staleTime: HOUR,
    })),
  });
  const out: Record<string, MoveDetail | null | undefined> = {};
  moveNames.forEach((m, i) => (out[m] = results[i]?.data));
  return out;
}
