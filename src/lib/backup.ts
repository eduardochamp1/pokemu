/**
 * Levar os dados do site para outro aparelho, sem servidor: tudo o que o site
 * guarda no `localStorage` vai para um arquivo `.json`, e o arquivo volta no
 * outro navegador.
 *
 * Fica de fora a última ROM aberta, que aponta para um arquivo que só existe
 * neste aparelho. Os saves do emulador também não vêm — vivem no IndexedDB e
 * já têm o backup em disco de `/jogar`.
 *
 * Migração: backup sem `guides` é anterior aos detonados no IndexedDB — o
 * texto vem dentro da ficha, e o carregamento seguinte o leva para o banco.
 * Versão diferente de 1 é recusada com motivo próprio, sem tentar adivinhar.
 */
import { backupProblems } from "./backupSchema";

export interface Backup {
  app: "pokedex";
  version: 1;
  exportedAt: string;
  /** Chave do localStorage -> valor, como está guardado. */
  data: Record<string, string>;
  /**
   * Texto dos detonados, por ROM. Vivem no IndexedDB, fora de `data`. Ausente
   * nos backups anteriores, em que o texto vinha dentro da ficha.
   */
  guides?: Record<string, string>;
}

interface StorageLike {
  readonly length: number;
  key(i: number): string | null;
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const FORA = new Set(["pokedex:emulator:last-rom"]);

/** As chaves que são do site: o prefixo, e o carrinho do Comparar, que é anterior a ele. */
export function isSiteKey(k: string): boolean {
  return (k.startsWith("pokedex:") || k === "comparator-cart") && !FORA.has(k);
}

function chaves(s: StorageLike): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k !== null) out.push(k);
  }
  return out;
}

export function collectBackup(s: StorageLike, now: Date = new Date()): Backup {
  const data: Record<string, string> = {};
  for (const k of chaves(s)) {
    const v = s.getItem(k);
    if (isSiteKey(k) && v !== null) data[k] = v;
  }
  return { app: "pokedex", version: 1, exportedAt: now.toISOString(), data };
}

/** Teto do arquivo: o `localStorage` inteiro cabe em ~5 MB, e os guias, à parte. */
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

export type BackupRead =
  | { ok: true; backup: Backup }
  | { ok: false; reason: "format" | "version" | "too-large" }
  | { ok: false; reason: "invalid"; problems: string[] };

/**
 * Lê e confere um backup inteiro antes de qualquer mudança: o envelope, e
 * cada registro conhecido contra a forma que o store dele espera.
 */
export function readBackup(text: string): BackupRead {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, reason: "too-large" };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, reason: "format" };
  }
  const b = v as Record<string, unknown> | null;
  if (b && typeof b === "object" && b.app === "pokedex" && typeof b.version === "number" && b.version !== 1) {
    return { ok: false, reason: "version" };
  }
  const envelope = lerEnvelope(v);
  if (!envelope) return { ok: false, reason: "format" };
  const problems = backupProblems(envelope.data);
  return problems.length > 0 ? { ok: false, reason: "invalid", problems } : { ok: true, backup: envelope };
}

/** `null` para qualquer coisa que não seja um backup deste site nesta versão, inteiro válido. */
export function parseBackup(text: string): Backup | null {
  const r = readBackup(text);
  return r.ok ? r.backup : null;
}

function lerEnvelope(v: unknown): Backup | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  if (b.app !== "pokedex" || b.version !== 1 || typeof b.exportedAt !== "string") return null;
  if (!Number.isFinite(Date.parse(b.exportedAt))) return null;
  if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) return null;
  const data = b.data as Record<string, unknown>;
  for (const [k, val] of Object.entries(data)) {
    if (!isSiteKey(k) || typeof val !== "string") return null;
  }
  const out: Backup = { app: "pokedex", version: 1, exportedAt: b.exportedAt, data: data as Record<string, string> };
  if (b.guides !== undefined) {
    if (!b.guides || typeof b.guides !== "object" || Array.isArray(b.guides)) return null;
    for (const text of Object.values(b.guides)) {
      if (typeof text !== "string" || text.length > 300_000) return null;
    }
    out.guides = b.guides as Record<string, string>;
  }
  return out;
}

/** A importação parou; `reverted` diz se os dados anteriores estão inteiros. */
export class BackupImportError extends Error {
  constructor(
    readonly stage: "prepare" | "data" | "guides",
    readonly reverted: boolean,
    cause: unknown
  ) {
    super(`importação do backup falhou em ${stage}`, { cause });
    this.name = "BackupImportError";
  }
}

export interface GuideStoreLike {
  all(): Promise<Record<string, string>>;
  /** Uma transação só: ou troca tudo, ou nada. */
  replaceAll(guides: Record<string, string>): Promise<void>;
}

/**
 * Importa o backup como uma operação só: registros do `localStorage` e
 * detonados do IndexedDB. Se os detonados não couberem, os registros voltam
 * ao que eram — a pessoa não fica com metade de um backup apresentada como
 * importada.
 */
export async function importBackup(s: StorageLike, b: Backup, guides: GuideStoreLike): Promise<void> {
  let antes: Backup;
  try {
    antes = collectBackup(s);
    await guides.all();
  } catch (error) {
    throw new BackupImportError("prepare", true, error);
  }
  try {
    applyBackup(s, b);
  } catch (error) {
    const falhouVolta = error instanceof Error && error.message === "Backup restore and rollback failed";
    throw new BackupImportError("data", !falhouVolta, error);
  }
  try {
    await guides.replaceAll(b.guides ?? {});
  } catch (error) {
    try {
      applyBackup(s, antes);
    } catch {
      throw new BackupImportError("guides", false, error);
    }
    throw new BackupImportError("guides", true, error);
  }
}

/** Troca os dados do site pelos do backup. O que não é do site fica como está. */
export function applyBackup(s: StorageLike, b: Backup): void {
  const previous = collectBackup(s);
  try {
    for (const k of chaves(s)) if (isSiteKey(k)) s.removeItem(k);
    for (const [k, v] of Object.entries(b.data)) s.setItem(k, v);
  } catch (error) {
    // Libera o backup parcial antes de repor os valores que já cabiam.
    // localStorage não oferece transação; se também falhar ao repor, informa.
    try {
      for (const k of chaves(s)) if (isSiteKey(k)) s.removeItem(k);
      for (const [k, v] of Object.entries(previous.data)) s.setItem(k, v);
    } catch {
      throw new Error("Backup restore and rollback failed", { cause: error });
    }
    throw error;
  }
}

export interface BackupSummary {
  favorites: number;
  trainerCards: number;
  playerDexes: number;
  /** Chaves restantes: preferências, recordes, atalhos. */
  other: number;
}

export function summarize(data: Record<string, string>): BackupSummary {
  const contar = (k: string, comoLista: boolean) => {
    try {
      const v: unknown = JSON.parse(data[k] ?? "null");
      if (comoLista) return Array.isArray(v) ? v.length : 0;
      return v && typeof v === "object" ? Object.keys(v).length : 0;
    } catch {
      return 0;
    }
  };
  const conhecidas = ["pokedex:favorites", "pokedex:trainer-log", "pokedex:player-dex", "pokedex:legacy-adventures"];
  return {
    favorites: contar("pokedex:favorites", true),
    trainerCards: contar("pokedex:trainer-log", false) + contar("pokedex:legacy-adventures", true),
    playerDexes: contar("pokedex:player-dex", false),
    other: Object.keys(data).filter((k) => !conhecidas.includes(k)).length,
  };
}

export function backupFileName(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `pokedex-dados-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}
