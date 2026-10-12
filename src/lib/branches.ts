import { kv } from "./idb";
import type { Capsule } from "./capsule";

/**
 * Ramificações de aventura: pontos preservados da partida inteira.
 *
 * Um ponto de retorno guarda um instante do emulador. Uma ramificação guarda a
 * aventura: o save de bateria, os pontos de retorno, o diário e as fichas
 * daquele momento — uma cápsula, só que dentro do navegador e com nome. Serve
 * para testar outro time ou outra escolha e depois comparar, ou voltar.
 *
 * Trocar de ramificação nunca perde nada: antes de restaurar uma, o estado
 * atual é guardado como outra.
 */

export interface Branch {
  id: string;
  rom: string;
  name: string;
  createdAt: number;
  /** Criada pelo site ao trocar de ramificação, para o estado anterior não se perder. */
  automatic?: boolean;
  capsule: Capsule;
}

const store = kv<Branch>("branches");

export const MAX_BRANCHES_PER_ROM = 12;

export async function listBranches(rom: string): Promise<Branch[]> {
  const todas = await store.all();
  return Object.values(todas)
    .filter((b) => b && b.rom === rom)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBranch(branch: Branch): Promise<void> {
  await store.put(branch.id, branch);
}

export async function deleteBranch(id: string): Promise<void> {
  await store.delete(id);
}

/** Leva as ramificações junto quando a ROM muda de nome. */
export async function renameBranches(from: string, to: string): Promise<void> {
  const todas = await store.all();
  for (const b of Object.values(todas)) {
    if (b.rom === from) await store.put(b.id, { ...b, rom: to });
  }
}

export function newBranch(
  rom: string,
  name: string,
  capsule: Capsule,
  automatic = false,
  now: number = Date.now(),
  id: string = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
): Branch {
  return { id, rom, name: name.trim().slice(0, 60) || "Ramificação", createdAt: now, capsule, ...(automatic ? { automatic } : {}) };
}

export interface BranchSummary {
  playSeconds?: number;
  badges?: number;
  owned?: number;
  team: { name: string; level: number | null }[];
  hasSave: boolean;
}

type Solto = Record<string, unknown> | undefined;
const obj = (v: unknown): Solto => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined);
const segundos = (t: unknown): number | undefined => {
  const p = obj(t);
  if (!p || typeof p.hours !== "number" || typeof p.minutes !== "number" || typeof p.seconds !== "number") return undefined;
  return p.hours * 3600 + p.minutes * 60 + p.seconds;
};
const contarVerdadeiros = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x === true).length : undefined);

/**
 * O que comparar entre ramificações, lido das fichas que vieram na cápsula
 * (Gen 3 ou Gen 1/2). Tolera ficha ausente ou de forma inesperada: o que não
 * dá para ler fica em branco, não vira zero.
 */
export function branchSummary(capsule: Capsule): BranchSummary {
  const hasSave = capsule.files.some((f) => f.kind === "save");
  const gen3 = obj(capsule.data["pokedex:trainer-log"]);
  if (gen3) {
    const trainer = obj(gen3.trainer);
    const fonte = Array.isArray(gen3.team) ? gen3.team : Array.isArray(gen3.party) ? gen3.party : [];
    return {
      playSeconds: segundos(trainer?.playTime),
      badges: contarVerdadeiros(trainer?.badges),
      owned: Array.isArray(gen3.owned) ? gen3.owned.length : undefined,
      team: fonte.flatMap((m) => {
        const mon = obj(m);
        return mon && typeof mon.nickname === "string"
          ? [{ name: mon.nickname, level: typeof mon.level === "number" ? mon.level : null }]
          : [];
      }),
      hasSave,
    };
  }
  const save = obj(obj(capsule.data["pokedex:legacy-adventures"])?.save);
  if (save) {
    const trainer = obj(save.trainer);
    const party = Array.isArray(save.party) ? save.party : [];
    return {
      playSeconds: segundos(trainer?.playTime),
      badges: contarVerdadeiros(trainer?.badges),
      owned: Array.isArray(obj(save.pokedex)?.owned) ? (obj(save.pokedex)!.owned as unknown[]).length : undefined,
      team: party.flatMap((m) => {
        const mon = obj(m);
        return mon && typeof mon.nickname === "string"
          ? [{ name: mon.nickname, level: typeof mon.level === "number" ? mon.level : null }]
          : [];
      }),
      hasSave,
    };
  }
  return { team: [], hasSave };
}
