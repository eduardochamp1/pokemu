// Traduções PT-BR para strings que vêm da PokéAPI em inglês. No modo EN, as
// funções devolvem o inglês da própria API.
import { getLang, type Lang } from "../i18n/lang";

const TYPES_PT: Record<string, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Veneno",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
};

const titulo = (s: string) =>
  s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Em inglês, o nome da PokéAPI com maiúscula: "fire" -> "Fire". */
export function tType(name: string | undefined | null, lang: Lang = getLang()): string {
  if (!name) return "";
  if (lang === "en") return titulo(name.toLowerCase());
  return TYPES_PT[name.toLowerCase()] ?? name;
}
