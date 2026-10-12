import type { mGBAEmulator } from "./types";
import { isSupportedRom } from "./types";
import { renameRomFiles, type FsLike } from "./romFiles";
import { loadRegistry, registerRom, sha256Hex, type RomSource } from "../lib/romIdentity";
import { renameGuideText } from "../lib/guideStore";
import { renameBranches } from "../lib/branches";
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

/**
 * Registra a ROM que acabou de entrar no FS. Se for um arquivo já conhecido
 * com outro nome, leva junto os dados e os arquivos do core, e devolve o nome
 * antigo.
 *
 * Tem que rodar **antes** do `loadGame`: é no carregamento que o core procura
 * o save de bateria pelo nome da ROM.
 *
 * Nunca lança: falhar em registrar não pode impedir ninguém de jogar.
 */
export async function registerLoadedRom(
  core: mGBAEmulator,
  rom: string,
  bytes: BufferSource,
  size: number,
  source: RomSource,
  folderNames: string[] | null
): Promise<string | undefined> {
  try {
    const hash = await sha256Hex(bytes);
    const present = presentNames(core, folderNames, rom);
    const { renamedFrom } = registerRom(localStorage, rom, hash, size, present, source);
    if (!renamedFrom) return undefined;

    renameRomFiles(core.FS as unknown as FsLike, core.filePaths(), renamedFrom, rom);
    // A cópia antiga da ROM é o mesmo conteúdo, e o arquivo de origem não
    // existe mais com aquele nome: deixá-la mostraria o jogo duas vezes.
    try {
      core.FS.unlink(`${core.filePaths().gamePath}/${renamedFrom}`);
    } catch {
      // já não estava lá
    }
    await renameGuideText(renamedFrom, rom).catch(() => undefined);
    await renameBranches(renamedFrom, rom).catch(() => undefined);
    reloadPersonalAdventures();
    reloadLegacyAdventures();
    reloadTrainerLog();
    reloadPlayerDex();
    reloadSessions();
    reloadChallenges();
    reloadMapMarks();
    return renamedFrom;
  } catch {
    return undefined;
  }
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
