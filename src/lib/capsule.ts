import { sha256Hex } from "./romIdentity";

/**
 * Cápsula de aventura: tudo de um jogo num arquivo só.
 *
 * O backup de "Seus dados" leva o que está no `localStorage`; o `.sav` leva a
 * partida. Faltava o conjunto: o save de bateria, os pontos de retorno, as
 * capturas, o diário, o detonado e as fichas daquele jogo, com um manifesto
 * que permite conferir cada arquivo antes de restaurar.
 *
 * O formato é JSON com os arquivos em base64. Pesa um terço a mais que um
 * zip, e em troca não traz biblioteca nenhuma e abre em qualquer editor.
 */

export type CapsuleFileKind = "save" | "state" | "thumbnail" | "screenshot";

export interface CapsuleFile {
  kind: CapsuleFileKind;
  /** Sufixo do arquivo depois do nome da ROM: ".sav", ".ss1", "_auto.ss"… */
  suffix: string;
  size: number;
  sha256: string;
  base64: string;
}

export interface Capsule {
  app: "pokemu-capsule";
  version: 1;
  exportedAt: string;
  rom: { fileName: string; hash?: string; size?: number };
  adventureId?: string;
  /**
   * Versão do core que gravou os pontos de retorno. Um estado é a memória
   * crua do emulador: outra versão do core pode não saber lê-lo. O save de
   * bateria não tem essa amarra — é o formato do próprio cartucho.
   */
  coreVersion: string;
  files: CapsuleFile[];
  /** Registros do `localStorage` deste jogo: chave -> a entrada da ROM. */
  data: Record<string, unknown>;
  /** Texto do detonado, quando há. */
  guide?: string;
}

/** Teto do arquivo inteiro. Um save tem 128 kB; um estado, algumas centenas. */
export const MAX_CAPSULE_BYTES = 64 * 1024 * 1024;

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function capsuleFile(
  kind: CapsuleFileKind,
  suffix: string,
  bytes: Uint8Array
): Promise<CapsuleFile> {
  // Cópia: o buffer pode vir da memória compartilhada do core.
  const copy = new Uint8Array(bytes);
  return { kind, suffix, size: copy.length, sha256: await sha256Hex(copy), base64: toBase64(copy) };
}

/**
 * Os sufixos que o core produz e o tipo de cada um; nada fora disso é escrito
 * no FS. É a única tabela: o manifesto, a prévia e o escritor derivam o tipo
 * daqui, então um `kind` que não bate com o sufixo é recusado na leitura.
 * A ordem importa: `.ssN.png` antes de `.ssN`.
 */
export const SUFFIX_KINDS: readonly { re: RegExp; kind: CapsuleFileKind }[] = [
  { re: /^\.sav$/, kind: "save" },
  { re: /^\.ss\d\.png$/, kind: "thumbnail" },
  { re: /^-\d{8}-\d{6}\.png$/, kind: "screenshot" },
  { re: /^(\.ss\d|_auto\.ss)$/, kind: "state" },
];

export function kindOfSuffix(suffix: string): CapsuleFileKind | undefined {
  return SUFFIX_KINDS.find((t) => t.re.test(suffix))?.kind;
}

/**
 * A exportação não conseguiu ler tudo o que existe da aventura. `items` diz o
 * quê: o sufixo do arquivo, `guide` ou a chave do registro.
 */
export class CapsuleIncompleteError extends Error {
  constructor(readonly items: string[]) {
    super(`cápsula incompleta: ${items.join(", ")}`);
    this.name = "CapsuleIncompleteError";
  }
}

/**
 * Uma operação falhou e desfazê-la também falhou: o estado não é mais o de
 * antes. `failed` diz o que ficou sem reverter; `cause` é o erro original.
 */
export class RollbackError extends Error {
  constructor(
    readonly failed: string[],
    cause: unknown
  ) {
    super(`não foi possível desfazer: ${failed.join(", ")}`, { cause });
    this.name = "RollbackError";
  }
}

export type ParseResult =
  | { ok: true; capsule: Capsule }
  | { ok: false; reason: "format" | "version" | "corrupt" | "too-large" };

/**
 * Lê e confere uma cápsula. Cada arquivo tem o tamanho e o SHA-256 do
 * manifesto verificados: um arquivo truncado no download é recusado aqui, e
 * não descoberto depois de ter sobrescrito o save bom.
 */
export async function parseCapsule(text: string): Promise<ParseResult> {
  if (text.length > MAX_CAPSULE_BYTES) return { ok: false, reason: "too-large" };
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, reason: "format" };
  }
  if (!v || typeof v !== "object") return { ok: false, reason: "format" };
  const c = v as Record<string, unknown>;
  if (c.app !== "pokemu-capsule") return { ok: false, reason: "format" };
  if (c.version !== 1) return { ok: false, reason: "version" };
  const rom = c.rom as Record<string, unknown> | undefined;
  if (
    typeof c.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(c.exportedAt)) ||
    !rom ||
    typeof rom.fileName !== "string" ||
    !/^[^/\\]+\.(gb|gbc|gba)$/i.test(rom.fileName) ||
    typeof c.coreVersion !== "string" ||
    !Array.isArray(c.files) ||
    !c.data ||
    typeof c.data !== "object" ||
    Array.isArray(c.data) ||
    (c.guide !== undefined && (typeof c.guide !== "string" || c.guide.length > 300_000))
  ) {
    return { ok: false, reason: "format" };
  }
  const vistos = new Set<string>();
  for (const f of c.files as unknown[]) {
    const file = f as Record<string, unknown> | null;
    if (
      !file ||
      typeof file.suffix !== "string" ||
      typeof file.kind !== "string" ||
      kindOfSuffix(file.suffix) !== file.kind ||
      vistos.has(file.suffix) ||
      typeof file.size !== "number" ||
      typeof file.sha256 !== "string" ||
      typeof file.base64 !== "string"
    ) {
      return { ok: false, reason: "format" };
    }
    vistos.add(file.suffix);
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = fromBase64(file.base64);
    } catch {
      return { ok: false, reason: "corrupt" };
    }
    if (bytes.length !== file.size || (await sha256Hex(bytes)) !== file.sha256) {
      return { ok: false, reason: "corrupt" };
    }
  }
  return { ok: true, capsule: v as Capsule };
}

export interface RestoreStep {
  file: CapsuleFile;
  /** `skip-core`: ponto de retorno de outra versão do core, que fica de fora. */
  action: "write" | "skip-core";
  /** Já existe um arquivo com este nome, que será substituído. */
  overwrites: boolean;
}

/**
 * O que restaurar faria, sem fazer. É o que a prévia mostra. Pura.
 *
 * Pontos de retorno e as miniaturas deles só voltam se o core for o mesmo que
 * os gravou. O save de bateria e as capturas voltam sempre.
 */
export function planRestore(
  capsule: Capsule,
  existingSuffixes: ReadonlySet<string>,
  coreVersion: string
): RestoreStep[] {
  const mesmoCore = capsule.coreVersion === coreVersion;
  return capsule.files.map((file) => {
    const kind = kindOfSuffix(file.suffix);
    const preso = kind !== "save" && kind !== "screenshot";
    const action = preso && !mesmoCore ? "skip-core" : "write";
    return { file, action, overwrites: action === "write" && existingSuffixes.has(file.suffix) };
  });
}

export function capsuleFileName(romFileName: string, d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const base = romFileName.replace(/\.(gb|gbc|gba)$/i, "");
  return `${base} - ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pokemu.json`;
}

/** Só o `localStorage` que isto usa. */
interface ReadableStorage {
  getItem(key: string): string | null;
}

interface StorageLike extends ReadableStorage {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Os registros por ROM e a forma de cada um — os mesmos da renomeação. */
const POR_ROM: { key: string; shape: "array" | "record" }[] = [
  { key: "pokedex:personal-adventures", shape: "array" },
  { key: "pokedex:legacy-adventures", shape: "array" },
  { key: "pokedex:trainer-log", shape: "record" },
  { key: "pokedex:player-dex", shape: "record" },
  { key: "pokedex:sessions", shape: "record" },
  { key: "pokedex:challenges", shape: "record" },
  { key: "pokedex:map-marks", shape: "record" },
];

/**
 * A entrada de uma ROM em cada registro. Um registro que não dá para ler vai
 * para `problems` em vez de sumir calado da cápsula.
 */
export function collectRomData(
  storage: ReadableStorage,
  rom: string,
  problems: string[] = []
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, shape } of POR_ROM) {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? "null");
      if (parsed !== null && (typeof parsed !== "object" || (shape === "array") !== Array.isArray(parsed))) {
        problems.push(key);
        continue;
      }
      const entry =
        shape === "array"
          ? Array.isArray(parsed)
            ? parsed.find((e) => (e as { rom?: unknown } | null)?.rom === rom)
            : undefined
          : parsed && typeof parsed === "object"
            ? (parsed as Record<string, unknown>)[rom]
            : undefined;
      if (entry !== undefined) out[key] = entry;
    } catch {
      problems.push(key);
    }
  }
  return out;
}

/**
 * Põe as entradas da cápsula nos registros, sob o nome `rom`. Só toca na
 * entrada desta ROM: as outras aventuras ficam como estão.
 *
 * Primeiro calcula tudo: um registro existente que não dá para ler recusa a
 * operação antes de qualquer gravação, em vez de ser trocado por um novo que
 * apagaria as outras aventuras. Se uma gravação falhar no meio, as que já
 * foram feitas são desfeitas — chave que não existia é removida. Se desfazer
 * também falhar, sobe um `RollbackError` dizendo quais chaves ficaram.
 */
export function applyRomData(storage: StorageLike, rom: string, data: Record<string, unknown>): void {
  const plano: { key: string; raw: string | null; next: string }[] = [];
  for (const { key, shape } of POR_ROM) {
    if (!(key in data)) continue;
    const entry = data[key];
    if (!entry || typeof entry !== "object") continue;
    const raw = storage.getItem(key);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw ?? "null");
    } catch {
      throw new Error(`registro ilegível: ${key}`);
    }
    const lista = shape === "array" ? Array.isArray(parsed) : !!parsed && typeof parsed === "object" && !Array.isArray(parsed);
    if (parsed !== null && !lista) throw new Error(`registro ilegível: ${key}`);
    const nova = { ...(entry as object), rom };
    const next =
      shape === "array"
        ? [...((parsed as unknown[] | null) ?? []).filter((e) => (e as { rom?: unknown } | null)?.rom !== rom), nova]
        : { ...((parsed as object | null) ?? {}), [rom]: nova };
    plano.push({ key, raw, next: JSON.stringify(next) });
  }
  const feitos: { key: string; raw: string | null }[] = [];
  try {
    for (const p of plano) {
      storage.setItem(p.key, p.next);
      feitos.push(p);
    }
  } catch (error) {
    const falhas: string[] = [];
    for (const { key, raw } of feitos.reverse()) {
      try {
        if (raw === null) storage.removeItem(key);
        else storage.setItem(key, raw);
      } catch {
        falhas.push(key);
      }
    }
    if (falhas.length > 0) throw new RollbackError(falhas, error);
    throw error;
  }
}
