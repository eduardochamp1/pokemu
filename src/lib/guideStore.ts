import { useEffect, useSyncExternalStore } from "react";
import { kv, resetMemoryStoresForTests } from "./idb";

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

const store = kv<string>("guides");

/**
 * O que já foi lido ou gravado nesta sessão. É o que deixa a tela mostrar o
 * guia recém-importado no mesmo instante, sem esperar a volta do banco.
 */
const cache = new Map<string, string | null>();
const listeners = new Set<() => void>();
const avisar = () => listeners.forEach((l) => l());

export async function readGuideText(rom: string): Promise<string | null> {
  const lido = await store.get(rom);
  const text = typeof lido === "string" ? lido : null;
  cache.set(rom, text);
  avisar();
  return text;
}

/** Rejeita se não couber: quem chama avisa, em vez de fingir que guardou. */
export async function writeGuideText(rom: string, text: string): Promise<void> {
  await store.put(rom, text);
  cache.set(rom, text);
  avisar();
}

export async function deleteGuideText(rom: string): Promise<void> {
  await store.delete(rom);
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
  const tudo = await store.all();
  return Object.fromEntries(Object.entries(tudo).filter(([, v]) => typeof v === "string"));
}

/** Troca tudo pelo que veio de um backup. */
export async function replaceAllGuideTexts(guides: Record<string, string>): Promise<void> {
  await store.replaceAll(guides);
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
  resetMemoryStoresForTests();
  cache.clear();
}
