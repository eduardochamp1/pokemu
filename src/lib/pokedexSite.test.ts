import { describe, expect, it } from "vitest";
import { pokedexBase, pokedexUrl } from "./pokedexSite";

describe("pokedexBase", () => {
  it("aceita http(s) e tira a barra do fim", () => {
    expect(pokedexBase("https://dex.example/")).toBe("https://dex.example");
    expect(pokedexBase(" http://localhost:3000 ")).toBe("http://localhost:3000");
  });

  it("sem endereço, ou com algo que não é URL, não há Pokédex", () => {
    expect(pokedexBase(undefined)).toBeNull();
    expect(pokedexBase("")).toBeNull();
    expect(pokedexBase("dex.example")).toBeNull();
  });
});

describe("pokedexUrl", () => {
  it("monta o endereço da página", () => {
    expect(pokedexUrl("/pokemon/pikachu", "https://dex.example")).toBe("https://dex.example/pokemon/pikachu");
    expect(pokedexUrl("mapa?region=hoenn", "https://dex.example")).toBe("https://dex.example/mapa?region=hoenn");
  });

  it("sem base devolve null, para o link virar texto", () => {
    expect(pokedexUrl("/lore", null)).toBeNull();
  });
});
