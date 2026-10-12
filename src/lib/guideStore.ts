import { useEffect, useSyncExternalStore } from "react";

/**
 * O texto dos detonados, fora do `localStorage`.
 *
 * Cada guia pode ter 300 mil caracteres, e o `localStorage` inteiro de uma
 * origem fica na casa de 5 milhões — com o diário, as fichas e o histórico no
 * mesmo lugar. Uma dúzia de guias grandes enchia a cota, e a partir daí
 * nenhuma nota nova era gravada. O texto vai para o IndexedDB; no
 * `localStorage` fica só o título, a fonte e o tamanho.
 *
 * O IndexedDB não é à prova de tudo — o navegador pode descartá-lo sob
 * pressão de disco — então o texto continua indo no backup de "Seus dados".
 */

const DB_NAME = "pokemu";
const STORE = "guides";

/** Onde não há IndexedDB (testes, modo restrito) o texto vale só na sessão. */
const memoria = new Map<string, string>();
const temIdb = () => typeof indexedDB !== "undefined";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function transacao<T>(
  modo: IDBTransactionMode,
  usar: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await abrir();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, modo);
      const req = usar(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * O que já foi lido ou gravado nesta sessão. É o que deixa a tela mostrar o
 * guia recém-importado no mesmo instante, sem esperar a volta do banco.
 */
const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();
const avisar = () => listeners.forEach((l) => l());

export async function readGuideText(rom: string): Promise<string | null> {
  const text = temIdb()
    ? ((await transacao<string>("readonly", (s) => s.get(rom))) ?? null)
    : (memoria.get(rom) ?? null);
  cache.set(rom, text);
  avisar();
  return text;
}

/** Rejeita se não couber: quem chama avisa, em vez de fingir que guardou. */
export async function writeGuideText(rom: string, text: string): Promise<void> {
  if (temIdb()) await transacao("readwrite", (s) => void s.put(text, rom));
  else memoria.set(rom, text);
  cache.set(rom, text);
  avisar();
}

export async function deleteGuideText(rom: string): Promise<void> {
  if (temIdb()) await transacao("readwrite", (s) => void s.delete(rom));
  else memoria.delete(rom);
  cache.set(rom, null);
  avisar();
}

/** Leva o guia junto quando a ROM muda de nome; não sobrescreve o do nome novo. */
export async function renameGuideText(from: string, to: string): Promise<void> {
  const text = await readGuideText(from);
  if (text === null || (await readGuideText(to)) !== null) return;
  await writeGuideText(to, text);
  await deleteGuideText(from);
}

/** Todos os guias, para o backup. */
export async function allGuideTexts(): Promise<Record<string, string>> {
  if (!temIdb()) return Object.fromEntries(memoria);
  const db = await abrir();
  try {
    return await new Promise((resolve, reject) => {
      const out: Record<string, string> = {};
      const req = db.transaction(STORE, "readonly").objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve(out);
        if (typeof cursor.value === "string") out[String(cursor.key)] = cursor.value;
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Troca tudo pelo que veio de um backup. */
export async function replaceAllGuideTexts(guides: Record<string, string>): Promise<void> {
  if (temIdb()) {
    await transacao("readwrite", (s) => {
      s.clear();
      for (const [rom, text] of Object.entries(guides)) s.put(text, rom);
    });
  } else {
    memoria.clear();
    for (const [rom, text] of Object.entries(guides)) memoria.set(rom, text);
  }
  cache.clear();
  avisar();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * O texto do guia de uma ROM: `undefined` enquanto carrega, `null` se não há.
 */
export function useGuideText(rom: string | undefined): string | null | undefined {
  const text = useSyncExternalStore(
    subscribe,
    () => (rom ? cache.get(rom) : null),
    () => undefined
  );
  useEffect(() => {
    if (rom && !cache.has(rom)) void readGuideText(rom).catch(() => undefined);
  }, [rom]);
  return text;
}

/** Só para os testes: zera o que ficou de um teste para o outro. */
export function resetGuideStoreForTests(): void {
  memoria.clear();
  cache.clear();
}
