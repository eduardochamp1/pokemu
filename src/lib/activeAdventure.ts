import { useSyncExternalStore } from "react";

/**
 * A aventura que a pessoa está acompanhando agora, uma só para o site inteiro.
 *
 * Aventuras, Ginásios, Ajuda e Planejar batalhas tinham cada uma o seu seletor
 * de save, começando do zero a cada visita: escolher Emerald em Ginásios e
 * abrir Planejar batalhas mostrava o time de outro jogo. Aqui a escolha é
 * guardada uma vez, pelo nome da ROM, e todas as páginas partem dela.
 *
 * Carregar um jogo no emulador também a define: quem acabou de jogar quer ver
 * a ficha daquele jogo.
 */

const KEY = "pokedex:active-adventure";

let active: string | undefined;
const listeners = new Set<() => void>();

/** Relê do `localStorage`. Usado ao iniciar e quando outra aba grava. */
export function reloadActiveAdventure(): void {
  try {
    active = localStorage.getItem(KEY) || undefined;
  } catch {
    active = undefined;
  }
  listeners.forEach((l) => l());
}

reloadActiveAdventure();

export function getActiveAdventure(): string | undefined {
  return active;
}

export function setActiveAdventure(rom: string): void {
  if (!rom || rom === active) return;
  active = rom;
  try {
    localStorage.setItem(KEY, rom);
  } catch {
    // sem localStorage a escolha vale só nesta visita
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) reloadActiveAdventure();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useActiveAdventure(): string | undefined {
  return useSyncExternalStore(subscribe, getActiveAdventure, () => undefined);
}

/**
 * Qual das aventuras de uma página corresponde à ativa.
 *
 * Nem toda página serve para toda aventura — Ginásios só conhece Emerald e
 * FR/LG. Quando a ativa não está entre as que a página aceita, vale a primeira
 * da lista, e `matched` diz que foi um recuo, para a tela poder explicar.
 */
export function pickAdventure<T extends { rom: string }>(
  candidates: readonly T[],
  activeRom: string | undefined
): { entry: T | undefined; matched: boolean } {
  const found = activeRom === undefined ? undefined : candidates.find((c) => c.rom === activeRom);
  return { entry: found ?? candidates[0], matched: found !== undefined || activeRom === undefined };
}

/** Nome para mostrar: o do arquivo, sem a extensão. */
export function adventureLabel(rom: string): string {
  return rom.replace(/\.[^.]+$/, "");
}
