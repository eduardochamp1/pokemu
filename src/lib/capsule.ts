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

const KINDS: readonly string[] = ["save", "state", "thumbnail", "screenshot"];
/** Os sufixos que o core produz; nada fora disso é escrito no FS. */
const SUFFIX = /^(\.sav|\.ss\d|_auto\.ss|\.ss\d\.png|-\d{8}-\d{6}\.png)$/;

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
      typeof file.kind !== "string" ||
      !KINDS.includes(file.kind) ||
      typeof file.suffix !== "string" ||
      !SUFFIX.test(file.suffix) ||
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
    const preso = file.kind === "state" || file.kind === "thumbnail";
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
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
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

/** A entrada de uma ROM em cada registro. */
export function collectRomData(storage: StorageLike, rom: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, shape } of POR_ROM) {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? "null");
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
      // registro quebrado: fica de fora da cápsula
    }
  }
  return out;
}

/**
 * Põe as entradas da cápsula nos registros, sob o nome `rom`. Só toca na
 * entrada desta ROM: as outras aventuras ficam como estão.
 *
 * Se uma gravação falhar no meio, as que já foram feitas são desfeitas — a
 * restauração é tudo ou nada.
 */
export function applyRomData(storage: StorageLike, rom: string, data: Record<string, unknown>): void {
  const antes: [string, string | null][] = [];
  try {
    for (const { key, shape } of POR_ROM) {
      if (!(key in data)) continue;
      const entry = data[key];
      if (!entry || typeof entry !== "object") continue;
      const raw = storage.getItem(key);
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw ?? "null");
      } catch {
        parsed = null;
      }
      const nova = { ...(entry as object), rom };
      const next =
        shape === "array"
          ? [...(Array.isArray(parsed) ? parsed.filter((e) => (e as { rom?: unknown } | null)?.rom !== rom) : []), nova]
          : { ...(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}), [rom]: nova };
      antes.push([key, raw]);
      storage.setItem(key, JSON.stringify(next));
    }
  } catch (error) {
    for (const [key, raw] of antes) {
      try {
        if (raw !== null) storage.setItem(key, raw);
      } catch {
        // sem como repor: o erro original sobe do mesmo jeito
      }
    }
    throw error;
  }
}
