/**
 * O que muda na interface conforme o jogo do save: insígnias, região e a
 * versão da PokéAPI. O parser só distingue Emerald, FR/LG e R/S — os pares
 * dividem o mesmo formato de save, então o lado do par vem do nome da ROM.
 */
import type { Gen3Game } from "../emulator/saveParse/gen3";
import { HOENN_BADGES, type Badge } from "../data/hoenn";
import { KANTO_BADGES } from "../data/kanto";

export function badgesOf(game: Gen3Game): Badge[] {
  return game === "frlg" ? KANTO_BADGES : HOENN_BADGES;
}

export function regionOfGame(game: Gen3Game): "kanto" | "hoenn" {
  return game === "frlg" ? "kanto" : "hoenn";
}

export function gameLabel(game: Gen3Game): string {
  if (game === "frlg") return "FireRed/LeafGreen";
  if (game === "rs") return "Ruby/Sapphire";
  return "Emerald";
}
