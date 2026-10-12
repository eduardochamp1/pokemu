import { expect, it } from "vitest";
import { walkthroughSources } from "./walkthroughSources";

it("associa as edições oficiais e os nomes duplicados da coleção", () => {
  for (const title of ["Red", "Blue", "Yellow", "Gold", "Silver", "Crystal", "Ruby", "Sapphire", "FireRed", "LeafGreen", "Emerald"]) {
    const sources = walkthroughSources(`Pokemon - ${title} Version (USA).gba`);
    expect(sources.map(source => source.language)).toEqual(["pt", "en"]);
  }
  expect(walkthroughSources("Pokemon - Leaf Green.gba")).toEqual(walkthroughSources("Pokemon - LeafGreen Version (USA).gba"));
  expect(walkthroughSources("Pokemon - Emerald.gba")).toEqual(walkthroughSources("Pokemon - Emerald Version (USA, Europe).gba"));
});

it("separa Midori e hacks dos guias internacionais e dos remakes", () => {
  expect(walkthroughSources("Pocket Monsters - Midori (Japan) (SGB Enhanced).gb")[0].scope).toContain("japonês");
  const rocket = walkthroughSources("Pokemon FireRed Rocket Edition (1).gba");
  expect(rocket).toHaveLength(1);
  expect(rocket[0].url).toContain("rocket-edition");
  const unbound = walkthroughSources("Pokemon Unbound (v2.1.1.1).gba");
  expect(unbound).toHaveLength(3);
  expect(unbound[0].scope).toContain("2.1.1.1");
  expect(walkthroughSources("Pokemon - FireRed Another Hack.gba")).toEqual([]);
  expect(walkthroughSources("Unknown.gba")).toEqual([]);
});
