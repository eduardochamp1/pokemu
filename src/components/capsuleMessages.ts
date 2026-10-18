import { RestoreError } from "../emulator/restoreTx";
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
 * O que dizer quando a restauração falha. Só afirma que nada mudou quando o
 * coordenador confirma que a aventura voltou inteira (ou nem começou).
 */
export function restoreFailureMessage(lang: Lang, error: unknown): string {
  if (error instanceof RestoreError) {
    if (error.stage === "busy") {
      return tr(lang, "Já há uma restauração em andamento. Espere ela terminar.", "A restore is already running. Wait for it to finish.");
    }
    if (error.reverted) {
      return error.stage === "prepare"
        ? tr(
            lang,
            "Não foi possível preparar a restauração, e nada foi alterado. Se uma restauração anterior ficou pendente, recupere-a primeiro; senão, verifique o espaço disponível.",
            "Couldn't prepare the restore, and nothing was changed. If an earlier restore is pending, recover it first; otherwise check available storage."
          )
        : tr(
            lang,
            "A restauração falhou e foi desfeita: arquivos, registros e detonado estão como antes. Verifique o espaço disponível.",
            "The restore failed and was undone: files, records and walkthrough are as they were. Check available storage."
          );
    }
    if (error.pending) {
      return tr(
        lang,
        "A restauração falhou e a volta ao estado anterior não terminou. O Pokemu tenta de novo ao abrir o emulador, ou agora pelo botão de recuperar. Não limpe os dados do site.",
        "The restore failed and going back to the previous state didn't finish. Pokemu retries when the emulator opens, or now with the recover button. Don't clear site data."
      );
    }
  }
  return tr(
    lang,
    "A restauração falhou sem confirmar o estado da aventura. Exporte a cápsula dela antes de continuar jogando.",
    "The restore failed without confirming the adventure's state. Export its capsule before playing on."
  );
}

/** O aviso depois de uma recuperação automática, ou `null`. */
export function recoveryMessage(lang: Lang, result: string, rom?: string): string | null {
  const nome = rom ?? "";
  switch (result) {
    case "reverted":
      return tr(lang, `Uma restauração de ${nome} foi interrompida e desfeita: a aventura voltou ao que era antes dela.`, `A restore of ${nome} was interrupted and undone: the adventure is back to how it was before.`);
    case "completed":
      return tr(lang, `Uma restauração de ${nome} interrompida no fim foi concluída.`, `A restore of ${nome} interrupted at the end was completed.`);
    case "pending":
      return tr(lang, `Uma restauração interrompida ainda não pôde ser desfeita. Tente recuperar de novo.`, `An interrupted restore couldn't be undone yet. Try recovering again.`);
    default:
      return null;
  }
}
