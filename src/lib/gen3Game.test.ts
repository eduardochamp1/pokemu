import { describe, it, expect } from "vitest";
import { badgesOf, gameLabel, regionOfGame } from "./gen3Game";

describe("badgesOf / regionOfGame / gameLabel", () => {
  it("FR/LG é Kanto, os outros Hoenn", () => {
    expect(badgesOf("frlg")[0]?.leader).toBe("Brock");
    expect(badgesOf("emerald")[0]?.leader).toBe("Roxanne");
    expect(badgesOf("rs")[7]?.leader).toBe("Juan");
    expect(regionOfGame("frlg")).toBe("kanto");
    expect(regionOfGame("rs")).toBe("hoenn");
  });
  it("nome do jogo", () => {
    expect(gameLabel("frlg")).toBe("FireRed/LeafGreen");
    expect(gameLabel("rs")).toBe("Ruby/Sapphire");
    expect(gameLabel("emerald")).toBe("Emerald");
  });
});
