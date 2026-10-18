/**
 * Gravar uma entrada de um registro por ROM sem apagar o que outra aba fez.
 *
 * Os stores guardam o registro inteiro numa chave do `localStorage` e mantêm
 * uma cópia em memória. Gravar a cópia de volta inteira apaga o que outra aba
 * escreveu depois dela — inclusive em outra aventura. Aqui cada gravação relê
 * a chave, troca só a entrada da ROM e confere se essa entrada ainda é a que
 * esta aba conhecia. Se outra aba mudou a mesma aventura, a gravação é
 * recusada com `StaleWriteError`: a tela recarrega e a pessoa decide de novo,
 * em vez de uma das duas edições sumir calada.
 */

export class StaleWriteError extends Error {
  constructor(readonly key: string, readonly rom: string) {
    super(`registro alterado em outra aba: ${key} / ${rom}`);
    this.name = "StaleWriteError";
  }
}

function lerCru(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * Troca a entrada `rom` de `key` por `next` (ou a remove, com `undefined`).
 * `known` é a entrada como esta aba a via; `valid` diz como a entrada atual
 * seria lida pelo store, para comparar com o mesmo filtro.
 */
export function writeRecordEntry<T>(
  key: string,
  rom: string,
  known: T | undefined,
  next: T | undefined,
  valid: (raw: unknown) => T | undefined
): void {
  const cru = lerCru(key);
  if (!igual(valid(cru[rom]), known)) throw new StaleWriteError(key, rom);
  const { [rom]: _antes, ...resto } = cru;
  void _antes;
  localStorage.setItem(key, JSON.stringify(next === undefined ? resto : { ...resto, [rom]: next }));
}

/** Recarrega o store quando outra aba mexe na chave dele. */
export function onOtherTab(key: string, reload: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const ouvir = (e: StorageEvent) => {
    if (e.key === key || e.key === null) reload();
  };
  window.addEventListener("storage", ouvir);
  return () => window.removeEventListener("storage", ouvir);
}
