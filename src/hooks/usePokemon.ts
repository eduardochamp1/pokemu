import { useCallback } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchJsonPublic,
  getPokemonIndex,
  resolveName,
  searchPokemon,
} from "../api";
import { buildNameIndex } from "../lib/filters";
import type { MoveDetail, Pokemon } from "../types/pokemon";

const HOUR = 60 * 60 * 1000;

/** Indice completo nome -> id. Um request, cacheado por uma hora. */
export function usePokemonIndex() {
  const query = useQuery({
    queryKey: ["pokemon-index"],
    queryFn: async ({ signal }) => buildNameIndex((await getPokemonIndex(signal)).results),
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
    queryFn: ({ signal }) => searchPokemon(nameOrId!, signal),
    enabled: Boolean(nameOrId),
    staleTime: 30 * 60 * 1000,
  });
}

export function usePokemonsByNames(names: string[]) {
  const queries = useQueries({
    queries: names.map((name) => ({
      queryKey: ["pokemon-detail", resolveName(name)],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        searchPokemon(name, signal),
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
    queryFn: ({ signal }) =>
      fetchJsonPublic<MoveDetail>(
        `https://pokeapi.co/api/v2/move/${moveName}`,
        signal
      ),
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
        fetchJsonPublic<MoveDetail>(`https://pokeapi.co/api/v2/move/${moveName}`, signal),
      staleTime: HOUR,
    })),
  });
  const out: Record<string, MoveDetail | null | undefined> = {};
  moveNames.forEach((m, i) => (out[m] = results[i]?.data));
  return out;
}
