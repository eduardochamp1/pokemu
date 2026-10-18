import { applyFileOps, dropReserves, planFileOps, revertFileOps, type CapsuleDirs, type CapsuleFs, type FileOps } from "./capsuleFs";
import { romDataPlan, romEntries, writeRomEntries, type Capsule, type RestoreStep } from "../lib/capsule";
import { deleteGuideText, readGuideText, writeGuideText } from "../lib/guideStore";
import { idbIsDurable, kv } from "../lib/idb";
import { reloadPersonalAdventures } from "../lib/personalAdventures";
import { reloadLegacyAdventures } from "../lib/legacyAdventures";
import { reloadTrainerLog } from "../lib/trainerLog";
import { reloadPlayerDex } from "../lib/playerDex";
import { reloadSessions } from "../lib/sessions";
import { reloadChallenges } from "../lib/challenge";
import { reloadMapMarks } from "../lib/mapMarks";

/**
 * Restaurar uma cápsula como uma operação só, entre três armazenamentos que
 * não têm transação em comum: o FS do core (arquivos), o `localStorage`
 * (registros) e o IndexedDB (detonado).
 *
 * Contrato:
 *
 * - **Modos.** `merge` é a cápsula importada de arquivo: grava o que ela traz
 *   e não tira nada. `replace` é a troca de ramificação: a aventura fica só
 *   com o que a ramificação tem — ponto de retorno, registro ou detonado que
 *   ela não traz sai. Capturas de tela são fotos da pessoa e ficam nos dois
 *   modos; preferências globais e outras aventuras nunca são tocadas.
 * - **Estados.** `prepared` → (arquivos, registros, detonado, sincronização)
 *   → `committing` → fim. Até `committing` estar gravado, qualquer falha — ou
 *   fechar a aba — leva de volta ao estado anterior. Depois dele, só falta
 *   apagar as reservas, e a recuperação termina isso.
 * - **Diário.** Antes de mudar qualquer coisa, grava no IndexedDB o que é
 *   preciso para desfazer: a entrada da ROM em cada registro, o detonado e
 *   quais arquivos viram reserva ou são gravados. As reservas
 *   (`<nome>.antes-da-capsula`) ficam no FS até o fim.
 * - **Uma por vez.** Uma segunda restauração, ou uma com diário pendente,
 *   é recusada até a primeira terminar ou ser recuperada.
 *
 * Sem IndexedDB o diário fica só na memória: a operação continua tudo ou
 * nada, mas um fechamento no meio não tem como ser retomado.
 */

export type RestoreMode = "merge" | "replace";

interface Journal {
  v: 1;
  rom: string;
  mode: RestoreMode;
  stage: "prepared" | "committing";
  startedAt: number;
  ops: FileOps;
  /** A entrada da ROM em cada registro antes; `null` onde não havia. */
  dataBefore: Record<string, unknown>;
  guideBefore: string | null;
}

const diario = kv<Journal>("journal");
const CHAVE = "restore";

/** O que o coordenador precisa do core. */
export interface RestoreCore {
  FS: unknown;
  filePaths(): CapsuleDirs;
  FSSync(): Promise<unknown>;
}

export type RestoreStage = "busy" | "prepare" | "files" | "data" | "guide" | "sync" | "commit";

/** Em que etapa a restauração parou, e como ficou a aventura. */
export class RestoreError extends Error {
  constructor(
    readonly stage: RestoreStage,
    /** `true` quando nada da aventura mudou: ou não começou, ou voltou inteira. */
    readonly reverted: boolean,
    cause: unknown,
    /** A volta não terminou; o diário ficou e a recuperação tenta de novo. */
    readonly pending = false
  ) {
    super(`restauração falhou em ${stage}`, { cause });
    this.name = "RestoreError";
  }
}

let ocupado = false;

function recarregarStores(): void {
  reloadPersonalAdventures();
  reloadLegacyAdventures();
  reloadTrainerLog();
  reloadPlayerDex();
  reloadSessions();
  reloadChallenges();
  reloadMapMarks();
}

/** Põe registros, detonado e arquivos como estavam. Devolve o que não voltou. */
async function desfazer(core: RestoreCore, j: Journal): Promise<string[]> {
  const falhas = revertFileOps(core.FS as CapsuleFs, j.ops);
  try {
    writeRomEntries(localStorage, j.rom, j.dataBefore);
  } catch {
    falhas.push("data");
  }
  try {
    if (j.guideBefore === null) await deleteGuideText(j.rom);
    else await writeGuideText(j.rom, j.guideBefore);
  } catch {
    falhas.push("guide");
  }
  try {
    await core.FSSync();
  } catch {
    falhas.push("sync");
  }
  return falhas;
}

export async function runRestore(
  core: RestoreCore,
  capsule: Capsule,
  target: string,
  steps: readonly RestoreStep[],
  mode: RestoreMode
): Promise<void> {
  if (ocupado) throw new RestoreError("busy", true, new Error("outra restauração em andamento"));
  ocupado = true;
  try {
    // Preparação: nada muda até o diário estar gravado.
    let j: Journal;
    try {
      if (await diario.get(CHAVE)) throw new Error("restauração anterior pendente de recuperação");
      const novos = romDataPlan(capsule.data, mode);
      const dataBefore = romEntries(localStorage, target);
      const guideBefore = await readGuideText(target);
      j = {
        v: 1,
        rom: target,
        mode,
        stage: "prepared",
        startedAt: Date.now(),
        ops: planFileOps(core.FS as CapsuleFs, core.filePaths(), target, steps, mode === "replace"),
        // Só as chaves que a restauração toca precisam voltar.
        dataBefore: Object.fromEntries(Object.keys(novos).map((k) => [k, dataBefore[k] ?? null])),
        guideBefore,
      };
      await diario.put(CHAVE, j);
    } catch (error) {
      throw new RestoreError("prepare", true, error);
    }

    let etapa: RestoreStage = "files";
    try {
      applyFileOps(core.FS as CapsuleFs, j.ops);
      etapa = "data";
      writeRomEntries(localStorage, target, romDataPlan(capsule.data, mode));
      etapa = "guide";
      if (capsule.guide) await writeGuideText(target, capsule.guide);
      else if (mode === "replace" && j.guideBefore !== null) await deleteGuideText(target);
      etapa = "sync";
      await core.FSSync();
      etapa = "commit";
      await diario.put(CHAVE, { ...j, stage: "committing" });
    } catch (error) {
      const falhas = await desfazer(core, j);
      if (falhas.length > 0) throw new RestoreError(etapa, false, error, true);
      await diario.delete(CHAVE).catch(() => {});
      throw new RestoreError(etapa, true, error);
    } finally {
      recarregarStores();
    }

    // Confirmado: o resto é limpeza. Se falhar, a recuperação termina.
    dropReserves(core.FS as CapsuleFs, j.ops);
    try {
      await core.FSSync();
      await diario.delete(CHAVE);
    } catch {
      // as reservas e o diário em `committing` ficam para a recuperação
    }
  } finally {
    ocupado = false;
  }
}

export type RecoveryResult = "none" | "completed" | "reverted" | "pending";

let ultimaRecuperacao: { result: RecoveryResult; rom?: string } = { result: "none" };

/** O resultado da última recuperação, para a tela avisar. */
export function lastRecovery(): { result: RecoveryResult; rom?: string } {
  return ultimaRecuperacao;
}

/**
 * Termina o que uma restauração interrompida deixou. Roda quando o core
 * abre, antes de qualquer jogo: com o diário em `committing`, só apaga as
 * reservas; antes disso, desfaz tudo. Se não conseguir, o diário fica e a
 * próxima tentativa recomeça do mesmo ponto — cada passo é idempotente.
 */
export async function recoverPendingRestore(core: RestoreCore): Promise<RecoveryResult> {
  if (ocupado) return "pending";
  ocupado = true;
  try {
    let j: Journal | undefined;
    try {
      j = await diario.get(CHAVE);
    } catch {
      return (ultimaRecuperacao = { result: "pending" }).result;
    }
    if (!j) return "none";
    if (j.stage === "committing") {
      dropReserves(core.FS as CapsuleFs, j.ops);
      try {
        await core.FSSync();
        await diario.delete(CHAVE);
      } catch {
        return (ultimaRecuperacao = { result: "pending", rom: j.rom }).result;
      }
      return (ultimaRecuperacao = { result: "completed", rom: j.rom }).result;
    }
    const falhas = await desfazer(core, j);
    recarregarStores();
    if (falhas.length > 0) return (ultimaRecuperacao = { result: "pending", rom: j.rom }).result;
    await diario.delete(CHAVE).catch(() => {});
    return (ultimaRecuperacao = { result: "reverted", rom: j.rom }).result;
  } finally {
    ocupado = false;
  }
}

/** Se um fechamento no meio da restauração poderia ser retomado. */
export const restoreIsRecoverable = idbIsDurable;

/** Só para os testes: simula reabrir o site depois de um fechamento no meio. */
export function resetRestoreLockForTests(): void {
  ocupado = false;
  ultimaRecuperacao = { result: "none" };
}
