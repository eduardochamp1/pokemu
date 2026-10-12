import type { Catalog } from "../lib/offlineCatalog";
import type { TypeName } from "./typeMatchups";
import type { Gym, GymMon } from "./gymLeaders";

/**
 * Os oito líderes de Johto em Gold, Silver e Crystal.
 *
 * Aqui ficam só a espécie, o nível e os nomes dos golpes de cada pokémon. Os
 * tipos da espécie e o tipo/poder de cada golpe saem do catálogo embarcado
 * (`resolveJohtoGyms`): a tabela de tipos e os tipos dos golpes da Gen 2 são
 * os mesmos da Gen 3 para estas espécies e golpes, então não há por que
 * escrever esses valores uma segunda vez — e um nome digitado errado aparece
 * no teste, que confere todos contra o catálogo.
 *
 * Os times foram transcritos de memória da decompilação (pret/pokecrystal,
 * `data/trainers/parties.asm`) e ainda não foram conferidos linha a linha
 * contra o arquivo. O guia usa só o tipo dos golpes de dano; o poder e os
 * golpes de status não entram na conta.
 *
 * Os oito ginásios de Kanto que vêm depois da Liga ficam de fora.
 */

type RawMon = [species: string, level: number, moves: string[]];

interface RawGym {
  leader: string;
  city: string;
  type: TypeName;
  badge: string;
  party: RawMon[];
}

const RAW: RawGym[] = [
  {
    leader: "Falkner",
    city: "Violet City",
    type: "flying",
    badge: "Zephyr Badge",
    party: [
      ["pidgey", 7, ["tackle", "mud-slap"]],
      ["pidgeotto", 9, ["tackle", "mud-slap", "gust"]],
    ],
  },
  {
    leader: "Bugsy",
    city: "Azalea Town",
    type: "bug",
    badge: "Hive Badge",
    party: [
      ["metapod", 14, ["tackle", "string-shot", "harden"]],
      ["kakuna", 14, ["poison-sting", "string-shot", "harden"]],
      ["scyther", 16, ["quick-attack", "leer", "fury-cutter"]],
    ],
  },
  {
    leader: "Whitney",
    city: "Goldenrod City",
    type: "normal",
    badge: "Plain Badge",
    party: [
      ["clefairy", 18, ["double-slap", "mimic", "encore", "metronome"]],
      ["miltank", 20, ["rollout", "attract", "stomp", "milk-drink"]],
    ],
  },
  {
    leader: "Morty",
    city: "Ecruteak City",
    type: "ghost",
    badge: "Fog Badge",
    party: [
      ["gastly", 21, ["lick", "spite", "mean-look", "curse"]],
      ["haunter", 21, ["hypnosis", "mimic", "curse", "night-shade"]],
      ["gengar", 25, ["hypnosis", "shadow-ball", "mean-look", "dream-eater"]],
      ["haunter", 23, ["spite", "mean-look", "mimic", "night-shade"]],
    ],
  },
  {
    leader: "Chuck",
    city: "Cianwood City",
    type: "fighting",
    badge: "Storm Badge",
    party: [
      ["primeape", 27, ["leer", "rage", "karate-chop", "fury-swipes"]],
      ["poliwrath", 30, ["hypnosis", "mind-reader", "surf", "dynamic-punch"]],
    ],
  },
  {
    leader: "Jasmine",
    city: "Olivine City",
    type: "steel",
    badge: "Mineral Badge",
    party: [
      ["magnemite", 30, ["thunderbolt", "supersonic", "sonic-boom", "thunder-wave"]],
      ["magnemite", 30, ["thunderbolt", "supersonic", "sonic-boom", "thunder-wave"]],
      ["steelix", 35, ["screech", "sunny-day", "rock-throw", "iron-tail"]],
    ],
  },
  {
    leader: "Pryce",
    city: "Mahogany Town",
    type: "ice",
    badge: "Glacier Badge",
    party: [
      ["seel", 27, ["headbutt", "icy-wind", "aurora-beam", "rest"]],
      ["dewgong", 29, ["headbutt", "icy-wind", "aurora-beam", "rest"]],
      ["piloswine", 31, ["icy-wind", "fury-attack", "mist", "blizzard"]],
    ],
  },
  {
    leader: "Clair",
    city: "Blackthorn City",
    type: "dragon",
    badge: "Rising Badge",
    party: [
      ["dragonair", 37, ["thunder-wave", "surf", "slam", "dragon-breath"]],
      ["dragonair", 37, ["thunder-wave", "thunderbolt", "slam", "dragon-breath"]],
      ["dragonair", 37, ["thunder-wave", "ice-beam", "slam", "dragon-breath"]],
      ["kingdra", 40, ["smokescreen", "surf", "hyper-beam", "dragon-breath"]],
    ],
  },
];

export const JOHTO_BADGES = RAW.map((g) => ({ name: g.badge, leader: g.leader, city: g.city }));

/** Para o teste conferir cada nome contra o catálogo. */
export const JOHTO_RAW: readonly RawGym[] = RAW;

/** Os ginásios com tipos e golpes resolvidos pelo catálogo. */
export function resolveJohtoGyms(c: Catalog): Gym[] {
  return RAW.map((g) => ({
    leader: g.leader,
    city: g.city,
    type: g.type,
    party: g.party.flatMap(([species, level, moves]): GymMon[] => {
      const row = c.species.find((s) => s[1] === species);
      if (!row) return [];
      return [
        {
          national: row[0],
          species,
          level,
          // Os DVs dos treinadores da Gen 2 não são um IV de 0–31; fica 0, como em FR/LG.
          iv: 0,
          types: row[2] as TypeName[],
          moves: moves.flatMap((slug) => {
            const m = c.moves.find((x) => x[1] === slug);
            return m ? [{ slug, type: m[2] as TypeName, power: m[3] }] : [];
          }),
        },
      ];
    }),
  }));
}
