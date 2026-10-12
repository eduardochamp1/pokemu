import { describe, expect, it } from "vitest";
import { calcLegacyDamage, isSpecialType, legacyHitsToKo, legacyStatsFor, type LegacyDamageInput } from "./legacyDamage";
import { loadLegacyCatalog } from "./legacyCatalog";

const base = async (generation: 1 | 2, extra: Partial<LegacyDamageInput>): Promise<LegacyDamageInput> => ({
  generation,
  level: 50,
  attack: 100,
  defense: 100,
  power: 80,
  moveType: "normal",
  attackerTypes: [],
  defenderTypes: ["normal"],
  chart: (await loadLegacyCatalog(generation)).chart,
  ...extra,
});

describe("fórmula de dano da Gen 1", () => {
  /**
   * Tauros nível 100 (Ataque 298) com Body Slam (85) contra Starmie (Defesa
   * 268). Os dois passam de 255 e caem para 74 e 67; daí
   * ⌊⌊42·85·74/67⌋/50⌋ + 2 = 80, 120 com STAB, e a rolagem de 102 a 120.
   */
  it("bate com a conta feita à mão, passo a passo", async () => {
    const r = calcLegacyDamage(
      await base(1, { level: 100, attack: 298, defense: 268, power: 85, attackerTypes: ["normal"], defenderTypes: ["water", "psychic"] })
    );
    expect(r.max).toBe(120);
    expect(r.min).toBe(102);
    expect(r.rolls).toHaveLength(39);
    expect(r.effectiveness).toBe(1);
  });

  /** Nível 5, Tackle (35), 11 de Ataque contra 10 de Defesa: ⌊⌊4·35·11/10⌋/50⌋ + 2 = 5. */
  it("no começo do jogo o +2 é quase todo o dano", async () => {
    const r = calcLegacyDamage(await base(1, { level: 5, attack: 11, defense: 10, power: 35 }));
    expect(r.max).toBe(5);
    expect(r.min).toBe(4);
  });

  it("o crítico dobra o nível na fórmula, não o dano", async () => {
    const normal = calcLegacyDamage(await base(1, {}));
    const critico = calcLegacyDamage(await base(1, { crit: true }));
    // Nível 50: (22·80·100/100)/50 + 2 = 37; nível 100: (42·80)/50 + 2 = 69.
    expect(normal.max).toBe(37);
    expect(critico.max).toBe(69);
  });

  it("status acima de 255 caem os dois para um quarto", async () => {
    // 300/200 vira 75/50: a razão é a mesma, e o resultado igual ao de 150/100.
    const grande = calcLegacyDamage(await base(1, { attack: 300, defense: 200 }));
    const pequeno = calcLegacyDamage(await base(1, { attack: 75, defense: 50 }));
    expect(grande.max).toBe(pequeno.max);
  });

  it("efetividade pela tabela da Gen 1", async () => {
    const fantasma = calcLegacyDamage(await base(1, { moveType: "ghost", defenderTypes: ["psychic"] }));
    expect(fantasma.effectiveness).toBe(0);
    expect(fantasma.max).toBe(0);
    const agua = calcLegacyDamage(await base(1, { moveType: "water", defenderTypes: ["rock", "ground"] }));
    expect(agua.effectiveness).toBe(4);
    expect(agua.max).toBe(37 * 4);
  });

  it("Explosion parte a defesa ao meio", async () => {
    const semEfeito = calcLegacyDamage(await base(1, { power: 170 }));
    const explosao = calcLegacyDamage(await base(1, { power: 170, moveSlug: "explosion" }));
    expect(explosao.max).toBeGreaterThan(semEfeito.max * 1.9);
  });

  it("queimadura e Reflect valem, e o crítico ignora os dois", async () => {
    const limpo = calcLegacyDamage(await base(1, {})).max;
    expect(calcLegacyDamage(await base(1, { burned: true })).max).toBeLessThan(limpo);
    expect(calcLegacyDamage(await base(1, { screen: true })).max).toBeLessThan(limpo);
    const critico = calcLegacyDamage(await base(1, { crit: true })).max;
    expect(calcLegacyDamage(await base(1, { crit: true, burned: true, screen: true })).max).toBe(critico);
  });
});

describe("fórmula de dano da Gen 2", () => {
  it("o crítico dobra o dano antes do +2", async () => {
    // (22·80)/50 = 35; normal 37, crítico 35·2 + 2 = 72.
    expect(calcLegacyDamage(await base(2, {})).max).toBe(37);
    expect(calcLegacyDamage(await base(2, { crit: true })).max).toBe(72);
  });

  it("chuva e sol mudam Água e Fogo", async () => {
    const agua = await base(2, { moveType: "water", defenderTypes: ["normal"] });
    expect(calcLegacyDamage({ ...agua, weather: "rain" }).max).toBe(Math.floor((37 * 3) / 2));
    expect(calcLegacyDamage({ ...agua, weather: "sun" }).max).toBe(Math.floor(37 / 2));
    expect(calcLegacyDamage({ ...agua, moveType: "normal", weather: "rain" }).max).toBe(37);
  });

  it("um golpe que acerta nunca dá menos que 1", async () => {
    const r = calcLegacyDamage(await base(2, { level: 2, attack: 5, defense: 200, power: 10, moveType: "normal", defenderTypes: ["rock", "steel"] }));
    expect(r.effectiveness).toBe(0.25);
    expect(r.min).toBeGreaterThanOrEqual(1);
  });

  it("Sombrio é especial e existe; Fantasma atinge Psíquico", async () => {
    expect(isSpecialType("dark")).toBe(true);
    expect(isSpecialType("ghost")).toBe(false);
    expect(calcLegacyDamage(await base(2, { moveType: "ghost", defenderTypes: ["psychic"] })).effectiveness).toBe(2);
  });
});

describe("status de uma espécie num nível", () => {
  /** Mewtwo nível 100, DVs 15, sem experiência de status: os números de vitrine. */
  it("bate com valores conhecidos", () => {
    const mewtwo = legacyStatsFor([106, 110, 90, 130, 154], 100, 15);
    expect(mewtwo).toEqual({ hp: 352, atk: 255, def: 215, spe: 295, spa: 343, spd: 343 });
  });

  it("experiência de status no máximo soma 63 no nível 100", () => {
    const sem = legacyStatsFor([100, 100, 100, 100, 100], 100, 15);
    const com = legacyStatsFor([100, 100, 100, 100, 100], 100, 15, 65535);
    expect(com.atk - sem.atk).toBe(63);
    expect(com.hp - sem.hp).toBe(63);
  });

  it("Gen 2 separa Ataque Especial e Defesa Especial", () => {
    const magnemite = legacyStatsFor([25, 35, 70, 45, 95, 55], 50, 15);
    expect(magnemite.spa).toBeGreaterThan(magnemite.spd);
  });

  /** O DV de HP sai dos outros: todos pares dá 0, todos ímpares dá 15. */
  it("o DV de HP depende da paridade dos outros", () => {
    const par = legacyStatsFor([50, 50, 50, 50, 50], 100, 8).hp;
    const impar = legacyStatsFor([50, 50, 50, 50, 50], 100, 15).hp;
    expect(impar - par).toBe(30);
  });
});

describe("legacyHitsToKo", () => {
  it("garantido só quando até a menor rolagem derruba no mesmo número de golpes", () => {
    expect(legacyHitsToKo({ min: 50, max: 60 }, 100)).toEqual({ hits: 2, guaranteed: true });
    expect(legacyHitsToKo({ min: 45, max: 60 }, 100)).toEqual({ hits: 2, guaranteed: false });
    expect(legacyHitsToKo({ min: 0, max: 0 }, 100)).toBeNull();
  });
});
