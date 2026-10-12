import { describe, expect, it } from "vitest";
import {
  buildNameIndex,
  extractIdFromUrl,
  namesForIds,
} from "./filters";

const RESULTS = [
  { name: "bulbasaur", url: "https://pokeapi.co/api/v2/pokemon/1/" },
  { name: "charmander", url: "https://pokeapi.co/api/v2/pokemon/4/" },
  { name: "charmeleon", url: "https://pokeapi.co/api/v2/pokemon/5/" },
  { name: "charizard", url: "https://pokeapi.co/api/v2/pokemon/6/" },
  { name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" },
  { name: "vulpix", url: "https://pokeapi.co/api/v2/pokemon/37/" },
  { name: "moltres", url: "https://pokeapi.co/api/v2/pokemon/146/" },
  { name: "charizard-mega-x", url: "https://pokeapi.co/api/v2/pokemon/10034/" },
];
const INDEX = buildNameIndex(RESULTS);

describe("extractIdFromUrl", () => {
  it("le o id com e sem barra final", () => {
    expect(extractIdFromUrl("https://pokeapi.co/api/v2/pokemon/25/")).toBe(25);
    expect(extractIdFromUrl("https://pokeapi.co/api/v2/pokemon/25")).toBe(25);
  });

  it("devolve undefined para url sem id", () => {
    expect(extractIdFromUrl("https://pokeapi.co/api/v2/pokemon/pikachu")).toBeUndefined();
  });
});

describe("buildNameIndex", () => {
  it("mapeia nome para id", () => {
    expect(INDEX.get("pikachu")).toBe(25);
    expect(INDEX.get("charizard-mega-x")).toBe(10034);
  });

  it("ignora entradas sem id numerico", () => {
    expect(buildNameIndex([{ name: "x", url: "/pokemon/x" }]).size).toBe(0);
  });
});

describe("namesForIds", () => {
  const index = buildNameIndex(RESULTS);

  it("traduz ids para nomes, na ordem dos ids", () => {
    expect(namesForIds([25, 1, 6], index)).toEqual(["pikachu", "bulbasaur", "charizard"]);
  });

  it("id que o índice não conhece fica de fora", () => {
    expect(namesForIds([1, 9999], index)).toEqual(["bulbasaur"]);
  });

  it("lista vazia dá lista vazia", () => {
    expect(namesForIds([], index)).toEqual([]);
  });
});
