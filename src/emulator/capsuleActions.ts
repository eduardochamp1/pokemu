import { coreVersion } from "./core";
import { collectRomFiles, existingSuffixes, type CapsuleFs } from "./capsuleFs";
import { runRestore } from "./restoreTx";
import type { mGBAEmulator } from "./types";
import { CapsuleIncompleteError, collectRomData, planRestore, type Capsule, type RestoreStep } from "../lib/capsule";
import { loadRegistry } from "../lib/romIdentity";
import { readGuideText } from "../lib/guideStore";

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

export { RestoreError } from "./restoreTx";

/**
 * Restaura a cápsula sob o nome `target`, como uma operação só: ver o
 * contrato em `restoreTx.ts`. Sem `exact` é a importação de cápsula (só
 * acrescenta e substitui); com `exact` é a troca de ramificação, e a aventura
 * fica só com o que a cápsula traz.
 */
export async function restoreCapsule(
  core: mGBAEmulator,
  capsule: Capsule,
  target: string,
  steps: readonly RestoreStep[],
  exact = false
): Promise<void> {
  await runRestore(core, capsule, target, steps, exact ? "replace" : "merge");
}
