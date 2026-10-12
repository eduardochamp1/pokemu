import { describe, expect, it } from "vitest";
import {
  indexFromCatalog,
  loadCatalog,
  moveFromCatalog,
  pokemonFromCatalog,
  withCatalogFallback,
} from "./offlineCatalog";
import { gen3MoveData, gen3PokemonTypes } from "./gen3Damage";
import { gen3Abilities } from "./teamSheet";
import { baseStatsOf, gen3Learnset } from "./damageSides";

describe("catálogo de Gen 3", () => {
  it("cobre as 386 espécies e os 354 golpes, sem buraco na numeração", async () => {
    const c = await loadCatalog();
    expect(c.species.map((s) => s[0])).toEqual(Array.from({ length: 386 }, (_, i) => i + 1));
    expect(c.moves.map((m) => m[0])).toEqual(Array.from({ length: 354 }, (_, i) => i + 1));
  });

  /**
   * Os mesmos casos que o README cita para a calculadora: se o catálogo
   * trouxesse os valores de hoje, a conta offline sairia diferente da online.
   */
  it("traz os valores da época, não os de hoje", async () => {
    const c = await loadCatalog();
    expect(gen3PokemonTypes(pokemonFromCatalog(c, "clefairy")!)).toEqual(["normal"]);
    expect(gen3PokemonTypes(pokemonFromCatalog(c, "magnemite")!)).toEqual(["electric", "steel"]);
    expect(gen3Abilities(pokemonFromCatalog(c, "gengar")!)).toEqual(["levitate"]);
    expect(gen3MoveData(moveFromCatalog(c, "tackle")!)).toEqual({ power: 35, type: "normal" });
    expect(gen3MoveData(moveFromCatalog(c, "outrage")!)).toEqual({ power: 90, type: "dragon" });
  });

  it("acha por nome e por número", async () => {
    const c = await loadCatalog();
    expect(pokemonFromCatalog(c, 258)?.name).toBe("mudkip");
    expect(pokemonFromCatalog(c, "MUDKIP")?.id).toBe(258);
    expect(moveFromCatalog(c, "33")?.name).toBe("tackle");
    expect(pokemonFromCatalog(c, "garchomp")).toBeNull();
    expect(moveFromCatalog(c, 999)).toBeNull();
  });

  it("serve o que a calculadora lê: status base e golpes que a espécie aprende", async () => {
    const c = await loadCatalog();
    const mudkip = pokemonFromCatalog(c, "mudkip")!;
    expect(baseStatsOf(mudkip)).toEqual({ hp: 50, atk: 70, def: 50, spa: 50, spd: 50, spe: 40 });
    expect(gen3Learnset(mudkip)).toContain("water-gun");
  });

  it("o índice tem os nomes com o número na URL", async () => {
    const lista = indexFromCatalog(await loadCatalog());
    expect(lista).toHaveLength(386);
    expect(lista[24]).toEqual({ name: "pikachu", url: "https://pokeapi.co/api/v2/pokemon/25/" });
  });
});

describe("withCatalogFallback", () => {
  it("com rede, o catálogo nem é consultado", async () => {
    let consultou = false;
    const r = await withCatalogFallback(async () => "da rede", () => {
      consultou = true;
      return "do catálogo";
    });
    expect(r).toBe("da rede");
    expect(consultou).toBe(false);
  });

  it("sem rede, responde do catálogo", async () => {
    const r = await withCatalogFallback(
      async () => {
        throw new TypeError("Failed to fetch");
      },
      (c) => pokemonFromCatalog(c, "pikachu")
    );
    expect(r?.id).toBe(25);
  });

  /** 404 é resposta: a API disse que não existe, e isso não vira outra coisa. */
  it("null da rede não aciona o catálogo", async () => {
    const r = await withCatalogFallback<{ id: number } | null>(async () => null, (c) => pokemonFromCatalog(c, "pikachu"));
    expect(r).toBeNull();
  });

  it("sem rede e fora do catálogo, sobe o erro da rede", async () => {
    await expect(
      withCatalogFallback(
        async () => {
          throw new TypeError("Failed to fetch");
        },
        (c) => pokemonFromCatalog(c, "garchomp")
      )
    ).rejects.toThrow("Failed to fetch");
  });

  it("pedido cancelado não vira resposta do catálogo", async () => {
    const abort = new Error("cancelado");
    abort.name = "AbortError";
    await expect(
      withCatalogFallback(
        async () => {
          throw abort;
        },
        (c) => pokemonFromCatalog(c, "pikachu")
      )
    ).rejects.toBe(abort);
  });
});
