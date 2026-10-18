import { useCallback, useEffect, useRef, useState } from "react";
import { getCore, getLoadedRom } from "../emulator/core";
import { buildCapsule, switchToBranch } from "../emulator/capsuleActions";
import {
  MAX_BRANCHES_PER_ROM,
  branchSummary,
  deleteBranch,
  listBranches,
  newBranch,
  saveBranch,
  type Branch,
} from "../lib/branches";
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
  /** A lista e de qual aventura ela é: uma resposta atrasada de outra não aparece aqui. */
  const [lista, setLista] = useState<{ rom: string | undefined; items: Branch[] }>({ rom: undefined, items: [] });
  const [nome, setNome] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const rom = roms.includes(escolhida) ? escolhida : (currentRom ?? roms[0]);

  const branches = lista.rom === rom ? lista.items.filter((b) => b.rom === rom) : [];

  // Cada leitura leva um número; só a mais recente publica. Ler A devagar e B
  // depressa não deixa A substituir a lista de B quando terminar.
  const geracao = useRef(0);
  const recarregar = useCallback(async () => {
    const minha = ++geracao.current;
    if (!rom) return setLista({ rom, items: [] });
    let items: Branch[];
    try {
      items = await listBranches(rom);
    } catch {
      items = [];
    }
    if (minha === geracao.current) setLista({ rom, items });
  }, [rom]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const data = (at: number) =>
    new Date(at).toLocaleString(localeOf(lang), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const guardar = async () => {
    if (!rom) return;
    if (branches.filter((b) => !b.automatic).length >= MAX_BRANCHES_PER_ROM) {
      setAviso(t(`Limite de ${MAX_BRANCHES_PER_ROM} ramificações por jogo. Apague uma para guardar outra.`, `Limit of ${MAX_BRANCHES_PER_ROM} branches per game. Delete one to save another.`));
      return;
    }
    setOcupado(true);
    setAviso(null);
    try {
      const core = await getCore();
      const capsule = await buildCapsule(core, rom);
      if (!capsule.files.some((f) => f.kind === "save")) {
        setAviso(t("Este jogo ainda não gravou dentro do jogo: não há partida para preservar.", "This game hasn't saved in-game yet: there's no progress to preserve."));
        return;
      }
      await saveBranch(newBranch(rom, nome || t("Ramificação", "Branch"), capsule));
      setNome("");
      await recarregar();
      setAviso(t("Ramificação guardada.", "Branch saved."));
    } catch (error) {
      setAviso(incompleteMessage(lang, error) ?? t("Não foi possível guardar a ramificação. Verifique o espaço do navegador.", "Couldn't save the branch. Check browser storage."));
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
      const atual = await buildCapsule(core, destino);
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
          "Guarde a aventura inteira com um nome para testar outro time ou outra escolha, e volte quando quiser. Fica neste navegador; para levar a outro aparelho, exporte a cápsula.",
          "Keep the whole adventure under a name to try another team or choice, and come back whenever. It stays in this browser; to move it to another device, export the capsule."
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

      {branches.length === 0 ? (
        <p className="play-panel-hint">{t("Nenhuma ramificação guardada para este jogo.", "No branch saved for this game.")}</p>
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
