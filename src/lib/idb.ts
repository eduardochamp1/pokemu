/**
 * O banco IndexedDB do site (`pokemu`) e um acesso chave → valor a cada store.
 *
 * Guarda o que não cabe no `localStorage`: o texto dos detonados, as
 * ramificações de aventura e o diário da restauração em andamento. Onde não há IndexedDB (testes, navegador com o
 * banco bloqueado) cada store cai num `Map` em memória — vale só na sessão,
 * mas a tela continua funcionando.
 *
 * As stores são criadas todas aqui, numa versão só: abrir o banco de dois
 * módulos com versões diferentes faria um deles falhar.
 */

const DB_NAME = "pokemu";
const DB_VERSION = 3;
const STORES = ["guides", "branches", "journal"] as const;
export type StoreName = (typeof STORES)[number];

const temIdb = () => typeof indexedDB !== "undefined";
const memoria: Record<StoreName, Map<string, unknown>> = { guides: new Map(), branches: new Map(), journal: new Map() };

/** Sem IndexedDB, nada daqui sobrevive a fechar a aba. */
export function idbIsDurable(): boolean {
  return temIdb();
}

/** Quanto esperar quando outra aba segura a versão anterior do banco aberta. */
export const IDB_BLOCKED_TIMEOUT_MS = 5000;

/** Outra aba, com a versão anterior do site, segura o banco: a atualização espera ela fechar. */
export class IdbBlockedError extends Error {
  constructor() {
    super("banco de dados bloqueado por outra aba do Pokemu");
    this.name = "IdbBlockedError";
  }
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let espera: ReturnType<typeof setTimeout> | undefined;
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => {
      clearTimeout(espera);
      const db = req.result;
      // Uma aba com a versão nova pediu para atualizar: esta solta o banco
      // em vez de travar a outra.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => {
      clearTimeout(espera);
      reject(req.error);
    };
    // Sem isto, a promessa ficaria pendurada até a outra aba fechar, e a tela
    // em "carregando" para sempre. Com o erro, quem chama avisa.
    req.onblocked = () => {
      espera = setTimeout(() => reject(new IdbBlockedError()), IDB_BLOCKED_TIMEOUT_MS);
    };
  });
}

async function transacao<T>(
  store: StoreName,
  modo: IDBTransactionMode,
  usar: (s: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await abrir();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, modo);
      const req = usar(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export interface Kv<T> {
  get(key: string): Promise<T | undefined>;
  /** Rejeita se não couber: quem chama avisa, em vez de fingir que guardou. */
  put(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  all(): Promise<Record<string, T>>;
  /** Troca tudo de uma vez, numa transação só. */
  replaceAll(entries: Record<string, T>): Promise<void>;
}

export function kv<T>(store: StoreName): Kv<T> {
  const mem = memoria[store] as Map<string, T>;
  return {
    async get(key) {
      return temIdb() ? await transacao<T>(store, "readonly", (s) => s.get(key)) : mem.get(key);
    },
    async put(key, value) {
      if (temIdb()) await transacao(store, "readwrite", (s) => void s.put(value, key));
      else mem.set(key, value);
    },
    async delete(key) {
      if (temIdb()) await transacao(store, "readwrite", (s) => void s.delete(key));
      else mem.delete(key);
    },
    async all() {
      if (!temIdb()) return Object.fromEntries(mem);
      const db = await abrir();
      try {
        return await new Promise<Record<string, T>>((resolve, reject) => {
          const out: Record<string, T> = {};
          const req = db.transaction(store, "readonly").objectStore(store).openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return resolve(out);
            out[String(cursor.key)] = cursor.value as T;
            cursor.continue();
          };
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    },
    async replaceAll(entries) {
      if (temIdb()) {
        await transacao(store, "readwrite", (s) => {
          s.clear();
          for (const [k, v] of Object.entries(entries)) s.put(v, k);
        });
      } else {
        mem.clear();
        for (const [k, v] of Object.entries(entries)) mem.set(k, v);
      }
    },
  };
}

/** Só para os testes: zera o que ficou em memória de um teste para o outro. */
export function resetMemoryStoresForTests(): void {
  for (const s of STORES) memoria[s].clear();
}
