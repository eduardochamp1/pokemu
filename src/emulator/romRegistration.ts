import type { mGBAEmulator } from "./types";
import { isSupportedRom } from "./types";
import { applyRomFileRename, planRomFileRename, reverseMoves, type FsLike } from "./romFiles";
import {
  commitRegistration,
  loadRegistry,
  registerRom,
  renameRomData,
  resolveRegistration,
  romDataConflicts,
  sha256Hex,
  type RomSource,
} from "../lib/romIdentity";
import { readGuideText, renameGuideText } from "../lib/guideStore";
import { listBranches, renameBranches } from "../lib/branches";
import { reloadLegacyAdventures } from "../lib/legacyAdventures";
import { reloadPersonalAdventures } from "../lib/personalAdventures";
import { reloadPlayerDex } from "../lib/playerDex";
import { reloadTrainerLog } from "../lib/trainerLog";
import { reloadSessions } from "../lib/sessions";
import { reloadChallenges } from "../lib/challenge";
import { reloadMapMarks } from "../lib/mapMarks";

/**
 * Liga o índice de identidade (`lib/romIdentity`) ao core.
 *
 * Fica fora do `useEmulator` porque não tem estado de React: recebe o core e
 * os nomes da pasta, e devolve o que aconteceu.
 */

const basename = (name: string) => name.replace(/^.*[/\\]/, "");

/**
 * Os nomes que ainda contam como "na biblioteca".
 *
 * Uma ROM vinda da pasta `roms/` continua copiada no FS do core depois de ser
 * renomeada no disco. Para ela, quem responde é a pasta: se o nome saiu de lá,
 * sumiu. Para o que veio pelo seletor, só existe a cópia, então vale o FS.
 */
function presentNames(
  core: mGBAEmulator,
  folderNames: string[] | null,
  current: string
): Set<string> {
  const registry = loadRegistry(localStorage);
  const present = new Set<string>([current]);
  for (const name of folderNames ?? []) present.add(basename(name));
  for (const name of core.listRoms()) {
    if (folderNames === null || registry[name]?.source !== "folder") present.add(name);
  }
  return present;
}

export type Registration =
  | { kind: "none" }
  /** Era um arquivo conhecido com outro nome: tudo foi junto. */
  | { kind: "renamed"; from: string }
  /**
   * Era uma renomeação, mas não deu para levar tudo: nada mudou de lugar e o
   * índice continua no nome antigo. `conflict` = o nome novo já tem dados;
   * `failed` = uma gravação falhou e foi desfeita.
   */
  | { kind: "blocked"; from: string; reason: "conflict" | "failed"; items: string[] };

/**
 * Registra a ROM que acabou de entrar no FS. Se for um arquivo já conhecido
 * com outro nome, leva junto os arquivos do core, os registros, o detonado e
 * as ramificações.
 *
 * Tem que rodar **antes** do `loadGame`: é no carregamento que o core procura
 * o save de bateria pelo nome da ROM.
 *
 * A renomeação é uma migração: primeiro confere tudo (nada pode ser
 * sobrescrito), depois move arquivos, registros, detonado e ramificações, e só
 * no fim, com os arquivos sincronizados, grava o índice com o nome novo. Uma falha no meio desfaz o que foi
 * feito; uma interrupção deixa o índice no nome antigo, e a próxima abertura
 * reconhece a renomeação de novo e termina — cada passo pula o que já foi.
 *
 * Fora a renomeação bloqueada, nunca impede ninguém de jogar: falhar em
 * registrar só deixa a ROM sem identidade até a próxima vez.
 */
export async function registerLoadedRom(
  core: mGBAEmulator,
  rom: string,
  bytes: BufferSource,
  size: number,
  source: RomSource,
  folderNames: string[] | null
): Promise<Registration> {
  let res: ReturnType<typeof resolveRegistration>;
  try {
    const hash = await sha256Hex(bytes);
    res = resolveRegistration(localStorage, rom, hash, size, presentNames(core, folderNames, rom), source);
    if (!res.renamedFrom) {
      commitRegistration(localStorage, res);
      return { kind: "none" };
    }
  } catch {
    return { kind: "none" };
  }

  const from = res.renamedFrom;
  const fs = core.FS as unknown as FsLike;
  const plano = planRomFileRename(fs, core.filePaths(), from, rom);
  try {
    // Conferência: nada muda se qualquer parte já existir no nome novo.
    const conflitos = [
      ...plano.conflicts,
      ...romDataConflicts(localStorage, from, rom),
      ...((await readGuideText(from)) !== null && (await readGuideText(rom)) !== null ? ["guide"] : []),
      ...((await listBranches(from)).length > 0 && (await listBranches(rom)).length > 0 ? ["branches"] : []),
    ];
    if (conflitos.length > 0) return { kind: "blocked", from, reason: "conflict", items: conflitos };
  } catch {
    return { kind: "blocked", from, reason: "failed", items: ["prepare"] };
  }

  const desfazer: (() => Promise<void> | void)[] = [];
  let etapa = "files";
  try {
    applyRomFileRename(fs, plano.moves);
    desfazer.push(() => applyRomFileRename(fs, reverseMoves(plano.moves)));
    etapa = "data";
    const movidas = renameRomData(localStorage, from, rom);
    if (movidas.length > 0) desfazer.push(() => void renameRomData(localStorage, rom, from));
    etapa = "guide";
    await renameGuideText(from, rom);
    desfazer.push(() => renameGuideText(rom, from));
    etapa = "branches";
    desfazer.push(() => renameBranches(rom, from));
    await renameBranches(from, rom);
    // Os arquivos no disco antes do índice: se o índice fosse para o nome
    // novo e a aba fechasse antes da sincronização, o save ficaria no nome
    // antigo sem nada que o reconhecesse.
    etapa = "sync";
    await core.FSSync();
    etapa = "registry";
    commitRegistration(localStorage, res);
  } catch {
    for (const passo of desfazer.reverse()) {
      try {
        await passo();
      } catch {
        // o índice continua no nome antigo: a próxima abertura termina
      }
    }
    recarregarStores();
    return { kind: "blocked", from, reason: "failed", items: [etapa] };
  }

  // A cópia antiga da ROM é o mesmo conteúdo, e o arquivo de origem não
  // existe mais com aquele nome: deixá-la mostraria o jogo duas vezes.
  try {
    core.FS.unlink(`${core.filePaths().gamePath}/${from}`);
  } catch {
    // já não estava lá
  }
  recarregarStores();
  return { kind: "renamed", from };
}

function recarregarStores(): void {
  reloadPersonalAdventures();
  reloadLegacyAdventures();
  reloadTrainerLog();
  reloadPlayerDex();
  reloadSessions();
  reloadChallenges();
  reloadMapMarks();
}

/**
 * Registra as ROMs que já estavam na biblioteca antes de o índice existir.
 *
 * Sem isto, quem já usava o site só teria o nome antigo registrado depois de
 * abrir cada jogo de novo — e renomear antes disso perderia o vínculo. Uma por
 * vez e cedendo a vez entre elas: são 16 a 32 MB por arquivo, e isto roda com
 * a página já em uso.
 */
export async function backfillIdentities(
  core: mGBAEmulator,
  folderNames: string[] | null
): Promise<void> {
  const naPasta = new Set((folderNames ?? []).map(basename));
  let nomes: string[];
  try {
    nomes = core.listRoms().filter(isSupportedRom);
  } catch {
    return;
  }
  // Todo mundo presente: no preenchimento inicial nada é renomeação.
  const present = new Set(nomes);
  for (const rom of nomes) {
    try {
      if (loadRegistry(localStorage)[rom]) continue;
      // Cópia: o digest não aceita memória compartilhada, e o tipo do FS não
      // garante que este buffer não seja.
      const bytes = new Uint8Array(core.FS.readFile(`${core.filePaths().gamePath}/${rom}`) as Uint8Array);
      const hash = await sha256Hex(bytes);
      registerRom(localStorage, rom, hash, bytes.length, present, naPasta.has(rom) ? "folder" : "upload");
    } catch {
      // arquivo ilegível ou storage indisponível: fica para a próxima visita
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}
