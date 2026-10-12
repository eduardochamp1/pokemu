/**
 * Identidade de cada ROM da biblioteca: o conteúdo (hash) e a aventura (ID).
 *
 * Diário, favoritos, fichas e histórico são guardados pelo nome do arquivo.
 * Sem mais nada, renomear `Pokemon Emerald.gba` para `Emerald.gba` deixava a
 * aventura inteira para trás. O hash do conteúdo é o que permite reconhecer o
 * mesmo arquivo com outro nome e levar os dados junto.
 *
 * São duas coisas separadas de propósito:
 *  - o **hash** identifica o conteúdo. Duas cópias do mesmo jogo têm o mesmo;
 *  - o **ID da aventura** identifica a jornada. Duas cópias na biblioteca são
 *    duas aventuras — nunca são fundidas só porque o arquivo é igual.
 *
 * Os outros registros continuam indexados pelo nome do arquivo; este é o
 * índice que diz a qual aventura cada nome pertence e que os acompanha numa
 * renomeação.
 */

export interface RomIdentity {
  /** SHA-256 do arquivo, em hexadecimal. */
  hash: string;
  /** Estável enquanto a aventura existir, inclusive depois de renomear. */
  adventureId: string;
  /** Tamanho em bytes: mudou sem o nome mudar, o conteúdo foi trocado. */
  size: number;
  firstSeen: number;
  /**
   * De onde o arquivo veio: da pasta `roms/` ou do seletor. Uma ROM da pasta
   * fica copiada no navegador mesmo depois de sair de lá, então "ainda está na
   * biblioteca" precisa ser respondido olhando a pasta, não a cópia.
   */
  source?: RomSource;
}

export type RomSource = "folder" | "upload";

export type RomRegistry = Record<string, RomIdentity>;

export const ROM_IDENTITY_KEY = "pokedex:rom-identity";

/** Só o que este módulo usa do `localStorage`, para os testes passarem um falso. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function isIdentity(v: unknown): v is RomIdentity {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.hash === "string" &&
    /^[0-9a-f]{64}$/.test(e.hash) &&
    typeof e.adventureId === "string" &&
    e.adventureId.length > 0 &&
    typeof e.size === "number" &&
    Number.isFinite(e.size) &&
    typeof e.firstSeen === "number" &&
    Number.isFinite(e.firstSeen) &&
    (e.source === undefined || e.source === "folder" || e.source === "upload")
  );
}

/** Lê e valida; entrada com forma errada é descartada sozinha. */
export function loadRegistry(storage: StorageLike): RomRegistry {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(ROM_IDENTITY_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: RomRegistry = {};
    for (const [rom, entry] of Object.entries(parsed)) {
      if (isIdentity(entry)) out[rom] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

export interface Resolution {
  registry: RomRegistry;
  identity: RomIdentity;
  /** Nome antigo do mesmo arquivo, quando isto é uma renomeação. */
  renamedFrom?: string;
}

/**
 * Decide a identidade de um arquivo que acabou de entrar. Pura.
 *
 * `present` são os nomes que ainda existem na biblioteca. É o que separa
 * renomear de duplicar: o mesmo conteúdo sob um nome novo só é a mesma
 * aventura se o nome antigo sumiu. Se os dois existem, são duas cópias, e a
 * nova começa uma aventura própria.
 */
export function resolveIdentity(
  registry: RomRegistry,
  rom: string,
  hash: string,
  size: number,
  present: ReadonlySet<string>,
  newId: () => string,
  now: number
): Resolution {
  const known = registry[rom];
  if (known) {
    // Mesmo nome, conteúdo trocado (um patch, uma versão nova do hack): para
    // quem joga continua sendo a mesma aventura, que é como o site já tratava.
    if (known.hash === hash && known.size === size) return { registry, identity: known };
    const identity = { ...known, hash, size };
    return { registry: { ...registry, [rom]: identity }, identity };
  }

  const sumidos = Object.entries(registry).filter(
    ([nome, e]) => e.hash === hash && !present.has(nome)
  );
  // Com dois candidatos não há como saber de qual deles este arquivo veio:
  // melhor começar do zero do que entregar a aventura errada.
  if (sumidos.length === 1) {
    const [antigo, identity] = sumidos[0];
    const next = { ...registry, [rom]: identity };
    delete next[antigo];
    return { registry: next, identity, renamedFrom: antigo };
  }

  const identity: RomIdentity = { hash, adventureId: newId(), size, firstSeen: now };
  return { registry: { ...registry, [rom]: identity }, identity };
}

/** Registros indexados pelo nome da ROM, e a forma de cada um. */
const POR_NOME: { key: string; shape: "array" | "record" }[] = [
  { key: "pokedex:personal-adventures", shape: "array" },
  { key: "pokedex:legacy-adventures", shape: "array" },
  { key: "pokedex:trainer-log", shape: "record" },
  { key: "pokedex:player-dex", shape: "record" },
  { key: "pokedex:sessions", shape: "record" },
];

/**
 * Leva os dados de `from` para `to` em cada registro. Devolve as chaves que
 * mudaram.
 *
 * Nunca sobrescreve: se `to` já tem dados num registro, aquele registro fica
 * como está — quem tem as duas coisas escolhe depois, e nada se perde.
 */
export function renameRomData(storage: StorageLike, from: string, to: string): string[] {
  const mudou: string[] = [];
  for (const { key, shape } of POR_NOME) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(storage.getItem(key) ?? "null");
    } catch {
      continue;
    }
    if (shape === "array") {
      if (!Array.isArray(parsed)) continue;
      const romDe = (e: unknown) => (e as { rom?: unknown } | null)?.rom;
      if (!parsed.some((e) => romDe(e) === from) || parsed.some((e) => romDe(e) === to)) continue;
      const next = parsed.map((e) => (romDe(e) === from ? { ...(e as object), rom: to } : e));
      storage.setItem(key, JSON.stringify(next));
      mudou.push(key);
    } else {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const rec = parsed as Record<string, unknown>;
      if (!(from in rec) || to in rec) continue;
      const { [from]: entry, ...rest } = rec;
      const movida = entry && typeof entry === "object" ? { ...entry, rom: to } : entry;
      storage.setItem(key, JSON.stringify({ ...rest, [to]: movida }));
      mudou.push(key);
    }
  }
  return mudou;
}

/**
 * Registra um arquivo e, se for uma renomeação, leva os dados junto.
 *
 * A ordem importa: os dados mudam de nome antes de o índice ser gravado. Se a
 * gravação falhar no meio, na próxima vez o arquivo ainda é reconhecido como
 * renomeado e a migração recomeça — `renameRomData` pula o que já foi.
 */
export function registerRom(
  storage: StorageLike,
  rom: string,
  hash: string,
  size: number,
  present: ReadonlySet<string>,
  source?: RomSource,
  newId: () => string = () => crypto.randomUUID(),
  now: number = Date.now()
): Resolution & { migrated: string[] } {
  const atual = loadRegistry(storage);
  let res = resolveIdentity(atual, rom, hash, size, present, newId, now);
  if (source && res.identity.source !== source) {
    const identity = { ...res.identity, source };
    res = { ...res, identity, registry: { ...res.registry, [rom]: identity } };
  }
  const migrated = res.renamedFrom ? renameRomData(storage, res.renamedFrom, rom) : [];
  if (res.registry !== atual) storage.setItem(ROM_IDENTITY_KEY, JSON.stringify(res.registry));
  return { ...res, migrated };
}

/** O ID da aventura de uma ROM, se ela já foi registrada. */
export function adventureIdOf(storage: StorageLike, rom: string): string | undefined {
  return loadRegistry(storage)[rom]?.adventureId;
}
