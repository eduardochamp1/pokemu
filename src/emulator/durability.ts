import { useSyncExternalStore } from "react";

/**
 * Se o progresso está guardado de verdade.
 *
 * O core grava o save na memória; só o `FSSync` o leva para o IndexedDB. Antes
 * cada chamada automática engolia o erro (`catch(() => undefined)`), e com a
 * cota cheia o jogo seguia com o progresso só em memória sem ninguém saber.
 * Aqui toda sincronização passa por uma fila só:
 *
 * - **Serial e sem sobreposição.** Pedir durante uma gravação marca que falta
 *   mais uma; quando a atual termina, roda uma — que já leva tudo o que mudou.
 * - **Nova tentativa limitada.** Falhou, tenta de novo depois de 1, 3 e 10 s.
 *   Esgotou, fica `failed` até a próxima gravação dar certo: o aviso não some
 *   sozinho.
 * - **Último sucesso.** A tela mostra quando foi a última gravação durável.
 *
 * O destino em disco (`saves/`, só em dev/preview) tem o próprio estado, ao
 * lado: um não finge pelo outro.
 */

export type PersistState = "idle" | "saving" | "saved" | "pending" | "failed";

export interface Durability {
  state: PersistState;
  /** Quando a última gravação deu certo (ms). */
  lastOk?: number;
  /** O motivo da última falha, enquanto não houver sucesso depois dela. */
  error?: string;
}

export interface DiskDurability extends Durability {
  /** `false` no modo web: não existe espelho em disco, e a tela não sugere que há. */
  available: boolean;
}

export const RETRY_DELAYS_MS = [1000, 3000, 10000];

type Sync = () => Promise<unknown>;

let browser: Durability = { state: "idle" };
let disk: DiskDurability = { state: "idle", available: false };
const listeners = new Set<() => void>();
const avisar = () => listeners.forEach((l) => l());

let emAndamento: Promise<void> | null = null;
let deNovo = false;
let tentativa = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let relogio: () => number = () => Date.now();

function definir(next: Durability): void {
  browser = next;
  avisar();
}

async function rodar(sync: Sync): Promise<void> {
  do {
    deNovo = false;
    definir({ ...browser, state: "saving" });
    try {
      await sync();
      tentativa = 0;
      definir({ state: deNovo ? "pending" : "saved", lastOk: relogio() });
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      if (deNovo) continue; // já há outra pedida: ela é a nova tentativa
      if (tentativa < RETRY_DELAYS_MS.length) {
        const espera = RETRY_DELAYS_MS[tentativa++];
        definir({ ...browser, state: "pending", error: motivo });
        timer = setTimeout(() => {
          timer = null;
          void requestPersist(sync);
        }, espera);
      } else {
        definir({ ...browser, state: "failed", error: motivo });
      }
    }
  } while (deNovo);
}

/**
 * Pede para gravar o FS no IndexedDB. Resolve quando a gravação pedida (ou
 * uma posterior, que a inclui) terminou — com sucesso ou não; o resultado
 * fica em `getDurability()`.
 */
export function requestPersist(sync: Sync): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (emAndamento) {
    deNovo = true;
    if (browser.state !== "saving") definir({ ...browser, state: "pending" });
    return emAndamento;
  }
  emAndamento = rodar(sync).finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

export function getDurability(): Durability {
  return browser;
}

export function getDiskDurability(): DiskDurability {
  return disk;
}

export function setDiskDurability(next: Partial<DiskDurability>): void {
  disk = { ...disk, ...next };
  avisar();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useDurability(): { browser: Durability; disk: DiskDurability } {
  const b = useSyncExternalStore(subscribe, getDurability, getDurability);
  const d = useSyncExternalStore(subscribe, getDiskDurability, getDiskDurability);
  return { browser: b, disk: d };
}

/** Só para os testes. */
export function resetDurabilityForTests(now?: () => number): void {
  if (timer) clearTimeout(timer);
  timer = null;
  emAndamento = null;
  deNovo = false;
  tentativa = 0;
  browser = { state: "idle" };
  disk = { state: "idle", available: false };
  relogio = now ?? (() => Date.now());
}
