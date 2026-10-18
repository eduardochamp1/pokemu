import { RestoreError } from "../emulator/capsuleActions";
import { CapsuleIncompleteError, kindOfSuffix } from "../lib/capsule";
import { tr, type Lang } from "../i18n/lang";

/**
 * As mensagens de falha da cápsula e das ramificações. Ficam juntas porque as
 * duas telas precisam dizer a mesma verdade: o que não foi lido e se a
 * aventura ficou ou não como estava.
 */

const REGISTROS: Record<string, [string, string]> = {
  "pokedex:personal-adventures": ["ficha da aventura", "adventure card"],
  "pokedex:legacy-adventures": ["ficha Gen 1/2", "Gen 1/2 card"],
  "pokedex:trainer-log": ["diário", "journal"],
  "pokedex:player-dex": ["Pokédex do jogador", "player Pokédex"],
  "pokedex:sessions": ["sessões", "sessions"],
  "pokedex:challenges": ["desafio", "challenge"],
  "pokedex:map-marks": ["marcações do mapa", "map marks"],
};

function itemLabel(lang: Lang, item: string): string {
  if (item === "guide") return tr(lang, "detonado", "walkthrough");
  const registro = REGISTROS[item];
  if (registro) return tr(lang, ...registro);
  switch (kindOfSuffix(item)) {
    case "save":
      return tr(lang, "save de bateria", "battery save");
    case "state":
      return tr(lang, `ponto de retorno ${item}`, `save state ${item}`);
    case "thumbnail":
      return tr(lang, `miniatura ${item}`, `thumbnail ${item}`);
    case "screenshot":
      return tr(lang, `captura ${item}`, `screenshot ${item}`);
    default:
      return item;
  }
}

/** Por que a cápsula não pôde ser montada, ou `null` se o erro for outro. */
export function incompleteMessage(lang: Lang, error: unknown): string | null {
  if (!(error instanceof CapsuleIncompleteError)) return null;
  const itens = error.items.map((i) => itemLabel(lang, i)).join(", ");
  return tr(
    lang,
    `Não foi possível ler: ${itens}. Nada foi exportado para não gerar uma cópia incompleta.`,
    `Couldn't read: ${itens}. Nothing was exported to avoid an incomplete copy.`
  );
}

/**
 * O que dizer quando a restauração falha. Só afirma que nada mudou quando a
 * falha foi nos arquivos e eles voltaram ao lugar.
 */
export function restoreFailureMessage(lang: Lang, error: unknown): string {
  if (error instanceof RestoreError && error.reverted) {
    return tr(
      lang,
      "A restauração falhou antes de mudar a aventura: os arquivos voltaram ao que eram. Verifique o espaço disponível.",
      "The restore failed before changing the adventure: the files are back as they were. Check available storage."
    );
  }
  return tr(
    lang,
    "A restauração parou no meio e não pôde ser desfeita por completo: parte da aventura já foi substituída. Não feche o Pokemu; tente restaurar de novo ou exporte o que estiver lá.",
    "The restore stopped midway and couldn't be fully undone: part of the adventure was already replaced. Don't close Pokemu; try restoring again or export what's there."
  );
}
