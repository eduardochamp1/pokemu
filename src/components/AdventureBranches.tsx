import { useCallback, useEffect, useRef, useState } from "react";
import { getCore, getLoadedRom } from "../emulator/core";
import { buildCapsule, switchToBranch } from "../emulator/capsuleActions";
import {
  BRANCH_BYTES_PER_ROM,
  BranchBudgetError,
  MAX_BRANCHES_PER_ROM,
  branchFileName,
  branchSummary,
  deleteBranch,
  listBranches,
  newBranch,
  saveBranch,
  type Branch,
} from "../lib/branches";
import { MAX_CAPSULE_BYTES, parseCapsule, type Capsule } from "../lib/capsule";
import { capsuleTarget } from "../lib/romConflict";
import { loadRegistry } from "../lib/romIdentity";
import { adventureLabel } from "../lib/activeAdventure";
import { localeOf, tr, useLang } from "../i18n/lang";
import { incompleteMessage, restoreFailureMessage } from "./capsuleMessages";

interface Props {
  roms: string[];
  currentRom?: string;
  onRestored: () => void;
}

/**
 * Ramificações de uma aventura: guardar o estado inteiro com um nome, voltar a
 * ele, e comparar os pontos guardados.
 *
 * Trocar de ramificação guarda primeiro o estado atual como outra — quem
 * troca nunca perde o que tinha. E só acontece com o jogo fechado, pelo mesmo
 * motivo da cápsula: aberto, o core regravaria o save por cima.
 */
export default function AdventureBranches({ roms, currentRom, onRestored }: Props) {
  const lang = useLang();
  const en = lang === "en";
  const t = (pt: string, enText: string) => tr(lang, pt, enText);
  const [escolhida, setEscolhida] = useState("");
  /**
   * A lista, de qual aventura ela é (uma resposta atrasada de outra não
   * aparece aqui) e se a última leitura deu certo. Falhar não é "vazio": a
   * última lista conhecida fica, marcada como desatualizada.
   */
  const [lista, setLista] = useState<{ rom: string | undefined; items: Branch[]; estado: "loading" | "ready" | "error" }>({
    rom: undefined,
    items: [],
    estado: "loading",
  });
  const importRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const rom = roms.includes(escolhida) ? escolhida : (currentRom ?? roms[0]);

  const daqui = lista.rom === rom;
  const branches = daqui ? lista.items.filter((b) => b.rom === rom) : [];
  const estado = daqui ? lista.estado : "loading";

  // Cada leitura leva um número; só a mais recente publica. Ler A devagar e B
  // depressa não deixa A substituir a lista de B quando terminar.
  const geracao = useRef(0);
  const recarregar = useCallback(async () => {
    const minha = ++geracao.current;
    if (!rom) return setLista({ rom, items: [], estado: "ready" });
    try {
      const items = await listBranches(rom);
      if (minha === geracao.current) setLista({ rom, items, estado: "ready" });
    } catch {
      if (minha === geracao.current) setLista((l) => ({ rom, items: l.rom === rom ? l.items : [], estado: "error" }));
    }
  }, [rom]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const data = (at: number) =>
    new Date(at).toLocaleString(localeOf(lang), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  /** Uma ramificação vira arquivo sem precisar restaurá-la: nome e data vão junto. */
  const exportar = (b: Branch) => {
    const capsule: Capsule = { ...b.capsule, branch: { name: b.name, createdAt: b.createdAt, ...(b.automatic ? { automatic: true } : {}) } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(capsule)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = branchFileName(b);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /** Traz uma ramificação exportada para a lista deste jogo, sem restaurá-la. */
  const importar = async (file: File | undefined) => {
    if (!file || !rom) return;
    setAviso(null);
    if (file.size > MAX_CAPSULE_BYTES) {
      setAviso(t("Arquivo grande demais para ser uma ramificação.", "File too large to be a branch."));
      return;
    }
    const res = await parseCapsule(await file.text());
    if (!res.ok) {
      setAviso(t("Este arquivo não é uma ramificação ou cápsula válida do Pokemu. Nada foi alterado.", "This file isn't a valid Pokemu branch or capsule. Nothing was changed."));
      return;
    }
    const { branch: meta, ...capsule } = res.capsule;
    const destino = capsuleTarget(capsule, loadRegistry(localStorage));
    if (capsule.rom.fileName !== rom && !destino.candidates.includes(rom)) {
      setAviso(
        t(
          `Esta ramificação é de ${adventureLabel(capsule.rom.fileName)}. Escolha esse jogo para importá-la.`,
          `This branch is from ${adventureLabel(capsule.rom.fileName)}. Choose that game to import it.`
        )
      );
      return;
    }
    const nomeRamo = meta?.name ?? t("Importada", "Imported");
    const quando = meta?.createdAt ?? Date.parse(capsule.exportedAt);
    if (branches.some((b) => b.name === nomeRamo && b.createdAt === quando)) {
      setAviso(t("Esta ramificação já está na lista.", "This branch is already in the list."));
      return;
    }
    setOcupado(true);
    try {
      await saveBranch(newBranch(rom, nomeRamo, capsule, meta?.automatic ?? false, quando));
      await recarregar();
      setAviso(t(`Ramificação "${nomeRamo}" importada.`, `Branch "${nomeRamo}" imported.`));
    } catch (error) {
      setAviso(
        error instanceof BranchBudgetError
          ? t("Esta ramificação não cabe no espaço reservado a este jogo.", "This branch doesn't fit in the space reserved for this game.")
          : t("Não foi possível importar a ramificação. Verifique o espaço do navegador.", "Couldn't import the branch. Check browser storage.")
      );
    } finally {
      setOcupado(false);
    }
  };

  const guardar = async () => {
    if (!rom) return;
    // O limite só vale contado numa lista que foi lida de fato.
    if (estado !== "ready") {
      setAviso(t("A lista de ramificações não foi lida. Tente ler de novo antes de guardar outra.", "The branch list wasn't read. Try reading it again before saving another."));
      return;
    }
    if (branches.filter((b) => !b.automatic).length >= MAX_BRANCHES_PER_ROM) {
      setAviso(t(`Limite de ${MAX_BRANCHES_PER_ROM} ramificações por jogo. Apague uma para guardar outra.`, `Limit of ${MAX_BRANCHES_PER_ROM} branches per game. Delete one to save another.`));
      return;
    }
    setOcupado(true);
    setAviso(null);
    try {
      const core = await getCore();
      const capsule = await buildCapsule(core, rom, "branch");
      if (!capsule.files.some((f) => f.kind === "save")) {
        setAviso(t("Este jogo ainda não gravou dentro do jogo: não há partida para preservar.", "This game hasn't saved in-game yet: there's no progress to preserve."));
        return;
      }
      await saveBranch(newBranch(rom, nome || t("Ramificação", "Branch"), capsule));
      setNome("");
      await recarregar();
      setAviso(t("Ramificação guardada.", "Branch saved."));
    } catch (error) {
      setAviso(
        incompleteMessage(lang, error) ??
          (error instanceof BranchBudgetError
            ? t(
                `Esta ramificação não cabe no espaço reservado a este jogo (${Math.round(BRANCH_BYTES_PER_ROM / 1048576)} MB). Apague uma guardada ou exporte-a antes.`,
                `This branch doesn't fit in the space reserved for this game (${Math.round(BRANCH_BYTES_PER_ROM / 1048576)} MB). Delete a saved one or export it first.`
              )
            : t("Não foi possível guardar a ramificação. Verifique o espaço do navegador.", "Couldn't save the branch. Check browser storage."))
      );
    } finally {
      setOcupado(false);
    }
  };

  const trocar = async (b: Branch) => {
    // O destino fica fixo desde o clique, e tem de ser a aventura da ramificação.
    const destino = rom;
    if (!destino || b.rom !== destino) return;
    if (getLoadedRom() === destino) {
      setAviso(t("Feche este jogo antes de trocar de ramificação.", "Close this game before switching branches."));
      return;
    }
    setOcupado(true);
    setAviso(null);
    let restaurando = false;
    try {
      const core = await getCore();
      // Primeiro o que está em uso agora vira uma ramificação: só depois de
      // ela estar gravada é que qualquer arquivo é substituído.
      const atual = await buildCapsule(core, destino, "branch");
      if (atual.files.length > 0) {
        await saveBranch(newBranch(destino, t(`Antes de voltar a "${b.name}"`, `Before returning to "${b.name}"`), atual, true));
      }
      restaurando = true;
      await switchToBranch(core, b, destino);
      onRestored();
      await recarregar();
      setAviso(t(`A aventura voltou para "${b.name}". O estado anterior ficou guardado na lista.`, `The adventure is back at "${b.name}". The previous state was kept in the list.`));
    } catch (error) {
      if (restaurando) {
        onRestored();
        setAviso(restoreFailureMessage(lang, error));
      } else {
        setAviso(
          incompleteMessage(lang, error) ??
            t("A troca não começou: a aventura não foi alterada. Verifique o espaço do navegador.", "The switch didn't start: the adventure wasn't changed. Check browser storage.")
        );
      }
      await recarregar();
    } finally {
      setOcupado(false);
    }
  };

  const resumo = (b: Branch) => {
    const s = branchSummary(b.capsule);
    const partes: string[] = [];
    if (s.playSeconds !== undefined) {
      partes.push(`${Math.floor(s.playSeconds / 3600)}h${String(Math.floor((s.playSeconds % 3600) / 60)).padStart(2, "0")}`);
    }
    if (s.badges !== undefined) partes.push(`${s.badges} ${en ? "badges" : "insígnias"}`);
    if (s.owned !== undefined) partes.push(`${s.owned} ${en ? "caught" : "capturados"}`);
    const time = s.team.map((m) => (m.level === null ? m.name : `${m.name} ${m.level}`)).join(", ");
    return { linha: partes.join(" · "), time };
  };

  if (roms.length === 0) return null;

  return (
    <section className="play-panel">
      <h2>{t("Ramificações", "Branches")}</h2>
      <p className="play-panel-hint">
        {t(
          "Guarde a aventura inteira com um nome para testar outro time ou outra escolha, e volte quando quiser. Voltar deixa a aventura exatamente como estava: save, pontos de retorno, diário, desafio, marcações e detonado. As capturas de tela são suas e ficam em todas as ramificações. Fica neste navegador; para levar a outro aparelho, exporte a cápsula.",
          "Keep the whole adventure under a name to try another team or choice, and come back whenever. Returning puts the adventure exactly as it was: save, save states, journal, challenge, marks and walkthrough. Screenshots are yours and stay across all branches. It stays in this browser; to move it to another device, export the capsule."
        )}
      </p>
      <div className="branch-new">
        <label>
          {t("Jogo", "Game")}
          <select value={rom ?? ""} onChange={(e) => setEscolhida(e.target.value)} disabled={ocupado}>
            {roms.map((name) => <option key={name} value={name}>{adventureLabel(name)}</option>)}
          </select>
        </label>
        <label>
          {t("Nome da ramificação", "Branch name")}
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} placeholder={t("Antes da Elite", "Before the Elite")} />
        </label>
        <button type="button" onClick={() => void guardar()} disabled={ocupado || !rom}>
          {t("Guardar o estado atual", "Save current state")}
        </button>
      </div>

      <div className="play-save-actions">
        <button type="button" className="play-linkish" onClick={() => importRef.current?.click()} disabled={ocupado || !rom}>
          {t("Importar ramificação…", "Import branch…")}
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void importar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {estado === "error" && (
        <p className="play-panel-hint" role="alert">
          {t(
            branches.length ? "Não foi possível ler as ramificações; esta é a última lista lida, pode estar desatualizada." : "Não foi possível ler as ramificações deste jogo. Elas não foram apagadas.",
            branches.length ? "Couldn't read the branches; this is the last list read and may be out of date." : "Couldn't read this game's branches. They weren't deleted."
          )}{" "}
          <button type="button" onClick={() => void recarregar()}>{t("Ler de novo", "Read again")}</button>
        </p>
      )}
      {estado === "loading" ? (
        <p className="play-panel-hint">{t("Lendo as ramificações…", "Reading branches…")}</p>
      ) : branches.length === 0 ? (
        estado === "ready" && <p className="play-panel-hint">{t("Nenhuma ramificação guardada para este jogo.", "No branch saved for this game.")}</p>
      ) : (
        <ul className="branch-list">
          {branches.map((b) => {
            const r = resumo(b);
            return (
              <li key={b.id}>
                <strong>
                  {b.name}
                  {b.automatic && <small> · {t("guardada pelo site", "kept by the site")}</small>}
                </strong>
                <small>
                  {data(b.createdAt)}
                  {r.linha && ` · ${r.linha}`}
                </small>
                {r.time && <small>{t("Time: ", "Team: ")}{r.time}</small>}
                <div className="play-save-actions">
                  <button type="button" onClick={() => void trocar(b)} disabled={ocupado}>
                    {t("Voltar a esta", "Return to this")}
                  </button>
                  {apagando === b.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteBranch(b.id).then(recarregar);
                          setApagando(null);
                        }}
                      >
                        {t("Apagar mesmo", "Really delete")}
                      </button>
                      <button type="button" className="play-linkish" onClick={() => setApagando(null)}>
                        {t("Manter", "Keep")}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="play-linkish" onClick={() => setApagando(b.id)}>
                      {t("Apagar…", "Delete…")}
                    </button>
                  )}
                  <button type="button" className="play-linkish" onClick={() => exportar(b)}>
                    {t("Exportar", "Export")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {aviso && <p className="play-panel-hint" role="status">{aviso}</p>}
    </section>
  );
}
