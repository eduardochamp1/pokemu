import { coreVersion } from "./core";
import { collectRomFiles, existingSuffixes, writeRestore, type CapsuleFs } from "./capsuleFs";
import type { mGBAEmulator } from "./types";
import {
  applyRomData,
  CapsuleIncompleteError,
  collectRomData,
  planRestore,
  RollbackError,
  type Capsule,
  type RestoreStep,
} from "../lib/capsule";
import { loadRegistry } from "../lib/romIdentity";
import { readGuideText, writeGuideText } from "../lib/guideStore";
import { reloadPersonalAdventures } from "../lib/personalAdventures";
import { reloadLegacyAdventures } from "../lib/legacyAdventures";
import { reloadTrainerLog } from "../lib/trainerLog";
import { reloadPlayerDex } from "../lib/playerDex";
import { reloadSessions } from "../lib/sessions";
import { reloadChallenges } from "../lib/challenge";
import { reloadMapMarks } from "../lib/mapMarks";

/**
 * Montar e restaurar a cápsula de uma ROM contra o core de verdade. Usado
 * pela exportação em arquivo e pelas ramificações, que são a mesma cápsula
 * guardada dentro do navegador.
 */

const fsDe = (core: mGBAEmulator) => core.FS as unknown as CapsuleFs;

/**
 * Monta a cápsula de uma ROM. Se algo que existe não puder ser lido — um
 * arquivo, o detonado ou um registro —, rejeita com `CapsuleIncompleteError`
 * dizendo o quê, em vez de entregar uma cápsula com buracos.
 */
export async function buildCapsule(core: mGBAEmulator, rom: string): Promise<Capsule> {
  const faltas: string[] = [];
  let files: Capsule["files"] = [];
  try {
    files = await collectRomFiles(fsDe(core), core.filePaths(), rom);
  } catch (error) {
    if (!(error instanceof CapsuleIncompleteError)) throw error;
    faltas.push(...error.items);
  }
  const identity = loadRegistry(localStorage)[rom];
  let guide: string | null = null;
  try {
    guide = await readGuideText(rom);
  } catch {
    faltas.push("guide");
  }
  const data = collectRomData(localStorage, rom, faltas);
  if (faltas.length > 0) throw new CapsuleIncompleteError(faltas);
  return {
    app: "pokemu-capsule",
    version: 1,
    exportedAt: new Date().toISOString(),
    rom: { fileName: rom, hash: identity?.hash, size: identity?.size },
    adventureId: identity?.adventureId,
    coreVersion: coreVersion(core),
    files,
    data,
    ...(guide ? { guide } : {}),
  };
}

/** O que restaurar a cápsula sob o nome `target` faria. */
export function planFor(core: mGBAEmulator, capsule: Capsule, target: string): RestoreStep[] {
  return planRestore(capsule, existingSuffixes(fsDe(core), core.filePaths(), target), coreVersion(core));
}

/**
 * Volta a aventura `target` para uma ramificação. Recusa ramificação de outra
 * aventura antes de tocar em qualquer coisa: uma lista desatualizada na tela
 * não pode virar a restauração de um snapshot alheio.
 */
export async function switchToBranch(
  core: mGBAEmulator,
  branch: { rom: string; capsule: Capsule },
  target: string
): Promise<void> {
  if (branch.rom !== target) throw new Error(`ramificação de ${branch.rom}, não de ${target}`);
  await restoreCapsule(core, branch.capsule, target, planFor(core, branch.capsule, target), true);
}

/** Em que etapa a restauração parou, e se o que mudou foi desfeito. */
export class RestoreError extends Error {
  constructor(
    readonly stage: "files" | "data" | "guide" | "sync",
    /** `true` só quando nada da aventura mudou: falhou nos arquivos e eles voltaram. */
    readonly reverted: boolean,
    cause: unknown
  ) {
    super(`restauração falhou em ${stage}`, { cause });
    this.name = "RestoreError";
  }
}

/**
 * Restaura a cápsula sob o nome `target`. Os arquivos primeiro: se falharem,
 * voltam sozinhos e os dados nem são tocados.
 *
 * Depois dos arquivos ainda não há volta: uma falha nos registros, no
 * detonado ou na sincronização deixa a aventura parcialmente restaurada, e o
 * `RestoreError` diz isso (`reverted: false`) para a interface não prometer
 * que nada mudou.
 */
export async function restoreCapsule(
  core: mGBAEmulator,
  capsule: Capsule,
  target: string,
  steps: readonly RestoreStep[],
  /** Tira os arquivos da ROM que a cápsula não traz (troca de ramificação). */
  exact = false
): Promise<void> {
  try {
    writeRestore(fsDe(core), core.filePaths(), target, steps, exact);
  } catch (error) {
    throw new RestoreError("files", !(error instanceof RollbackError), error);
  }
  try {
    try {
      applyRomData(localStorage, target, capsule.data);
    } catch (error) {
      throw new RestoreError("data", false, error);
    }
    try {
      if (capsule.guide) await writeGuideText(target, capsule.guide);
    } catch (error) {
      throw new RestoreError("guide", false, error);
    }
    try {
      await core.FSSync();
    } catch (error) {
      throw new RestoreError("sync", false, error);
    }
  } finally {
    // Mesmo parcial, a tela mostra o que de fato está gravado agora.
    reloadPersonalAdventures();
    reloadLegacyAdventures();
    reloadTrainerLog();
    reloadPlayerDex();
    reloadSessions();
    reloadChallenges();
    reloadMapMarks();
  }
}
