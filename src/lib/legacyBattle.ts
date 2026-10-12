import type { TypeName } from "../data/typeMatchups";
import type { LegacySave } from "../emulator/saveParse/legacy";
import type { BattleMember } from "./gymGuide";
import type { Catalog } from "./offlineCatalog";

/**
 * O time de um save de Gen 2 na forma que o guia de ginásios usa.
 *
 * Os tipos das espécies e dos golpes vêm do catálogo de Gen 3: para as 251
 * espécies e os 251 golpes da Gen 2 eles são os mesmos, e a tabela de tipos
 * também. Para a **Gen 1 isso não vale** — não havia Aço nem Sombrio, Bite e
 * Gust eram Normal, Magnemite era só Elétrico, e Fantasma não atingia
 * Psíquico — então um save de Gen 1 não entra aqui.
 *
 * Ovo fica de fora: não luta. Nível ausente (não deveria acontecer no time)
 * vira 1 em vez de derrubar a página.
 */
export function legacyBattleTeam(c: Catalog, save: LegacySave): BattleMember[] {
  if (save.generation !== 2) return [];
  return save.party.flatMap((mon): BattleMember[] => {
    if (mon.egg) return [];
    const especie = c.species.find((s) => s[0] === mon.national);
    if (!especie) return [];
    return [
      {
        name: mon.nickname,
        national: mon.national,
        level: mon.level ?? 1,
        types: especie[2] as TypeName[],
        moves: mon.moves.flatMap((mv) => {
          const g = c.moves.find((m) => m[0] === mv.id);
          return g ? [{ slug: g[1], type: g[2] as TypeName, power: g[3] }] : [];
        }),
      },
    ];
  });
}
