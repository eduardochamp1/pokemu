import { coreVersion } from "./core";
import { collectRomFiles, existingSuffixes, writeRestore, type CapsuleFs } from "./capsuleFs";
import type { mGBAEmulator } from "./types";
import { applyRomData, collectRomData, planRestore, type Capsule, type RestoreStep } from "../lib/capsule";
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

export async function buildCapsule(core: mGBAEmulator, rom: string): Promise<Capsule> {
  const files = await collectRomFiles(fsDe(core), core.filePaths(), rom);
  const identity = loadRegistry(localStorage)[rom];
  const guide = await readGuideText(rom).catch(() => null);
  return {
    app: "pokemu-capsule",
    version: 1,
    exportedAt: new Date().toISOString(),
    rom: { fileName: rom, hash: identity?.hash, size: identity?.size },
    adventureId: identity?.adventureId,
    coreVersion: coreVersion(core),
    files,
    data: collectRomData(localStorage, rom),
    ...(guide ? { guide } : {}),
  };
}

/** O que restaurar a cápsula sob o nome `target` faria. */
export function planFor(core: mGBAEmulator, capsule: Capsule, target: string): RestoreStep[] {
  return planRestore(capsule, existingSuffixes(fsDe(core), core.filePaths(), target), coreVersion(core));
}

/**
 * Restaura a cápsula sob o nome `target`. Os arquivos primeiro: se falharem,
 * voltam sozinhos e os dados nem são tocados.
 */
export async function restoreCapsule(
  core: mGBAEmulator,
  capsule: Capsule,
  target: string,
  steps: readonly RestoreStep[],
  /** Tira os arquivos da ROM que a cápsula não traz (troca de ramificação). */
  exact = false
): Promise<void> {
  writeRestore(fsDe(core), core.filePaths(), target, steps, exact);
  applyRomData(localStorage, target, capsule.data);
  if (capsule.guide) await writeGuideText(target, capsule.guide);
  await core.FSSync();
  reloadPersonalAdventures();
  reloadLegacyAdventures();
  reloadTrainerLog();
  reloadPlayerDex();
  reloadSessions();
  reloadChallenges();
  reloadMapMarks();
}
