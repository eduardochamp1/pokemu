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
 *
 * Política de espaço (o produto oferece pontos preservados, não campanhas
 * paralelas): as guardadas pela pessoa ficam até ela apagar, no máximo
 * `MAX_BRANCHES_PER_ROM`. As automáticas, criadas a cada troca, guardam só as
 * `MAX_AUTOMATIC_PER_ROM` mais novas, e o total de um jogo cabe em
 * `BRANCH_BYTES_PER_ROM`: passando, saem as automáticas mais antigas — nunca
 * uma manual, e nunca a que acabou de ser guardada. As capturas de tela não
 * entram (são da pessoa e ficam em todas as ramificações), o que tira o
 * maior peso repetido de cada ponto.
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
export const MAX_AUTOMATIC_PER_ROM = 5;
export const BRANCH_BYTES_PER_ROM = 48 * 1024 * 1024;

/** O peso de uma ramificação como ela vai para o banco. */
export const branchBytes = (b: Branch): number => JSON.stringify(b.capsule).length;

/**
 * Quais ramificações automáticas sair para a política valer, sem mexer em
 * nada. Pura. `manter` é a que acabou de ser guardada: nunca entra.
 */
export function branchesToPrune(branches: readonly Branch[], manter?: string): Branch[] {
  const automaticas = branches
    .filter((b) => b.automatic && b.id !== manter)
    .sort((a, b) => a.createdAt - b.createdAt);
  const sair = new Set<string>();
  const totalAuto = automaticas.length + (branches.some((b) => b.id === manter && b.automatic) ? 1 : 0);
  for (let i = 0; i < totalAuto - MAX_AUTOMATIC_PER_ROM && i < automaticas.length; i++) sair.add(automaticas[i].id);
  let total = branches.filter((b) => !sair.has(b.id)).reduce((s, b) => s + branchBytes(b), 0);
  for (const b of automaticas) {
    if (total <= BRANCH_BYTES_PER_ROM) break;
    if (sair.has(b.id)) continue;
    sair.add(b.id);
    total -= branchBytes(b);
  }
  return branches.filter((b) => sair.has(b.id));
}

/** Uma ramificação manual não cabe no espaço do jogo, nem tirando as automáticas. */
export class BranchBudgetError extends Error {
  constructor(readonly bytes: number) {
    super(`ramificação não cabe: ${bytes} bytes`);
    this.name = "BranchBudgetError";
  }
}

export async function listBranches(rom: string): Promise<Branch[]> {
  const todas = await store.all();
  return Object.values(todas)
    .filter((b) => b && b.rom === rom)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Guarda e aplica a política de espaço. A nova é gravada antes de qualquer
 * descarte: faltando espaço, o que já existia fica intacto. Uma manual que
 * nem tirando todas as automáticas caberia é recusada antes de gravar.
 */
export async function saveBranch(branch: Branch): Promise<void> {
  const doJogo = (await listBranches(branch.rom)).filter((b) => b.id !== branch.id);
  if (!branch.automatic) {
    const fixas = doJogo.filter((b) => !b.automatic).reduce((s, b) => s + branchBytes(b), 0);
    if (fixas + branchBytes(branch) > BRANCH_BYTES_PER_ROM) throw new BranchBudgetError(branchBytes(branch));
  }
  await store.put(branch.id, branch);
  for (const b of branchesToPrune([...doJogo, branch], branch.id)) {
    try {
      await store.delete(b.id);
    } catch {
      // sobra uma automática antiga; a próxima gravação tenta de novo
    }
  }
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

/** Nome do arquivo de uma ramificação exportada: jogo, nome e data. */
export function branchFileName(b: Pick<Branch, "rom" | "name" | "createdAt">): string {
  const d = new Date(b.createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const base = b.rom.replace(/\.(gb|gbc|gba)$/i, "");
  const nome = b.name.replace(/[\\/:*?"<>|]/g, "-");
  return `${base} - ${nome} - ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pokemu.json`;
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
