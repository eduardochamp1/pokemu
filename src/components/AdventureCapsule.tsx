import { useRef, useState } from "react";
import { coreVersion, getCore, getLoadedRom } from "../emulator/core";
import {
  collectRomFiles,
  existingSuffixes,
  writeRestore,
  type CapsuleFs,
} from "../emulator/capsuleFs";
import {
  MAX_CAPSULE_BYTES,
  applyRomData,
  capsuleFileName,
  collectRomData,
  parseCapsule,
  planRestore,
  type Capsule,
  type RestoreStep,
} from "../lib/capsule";
import { loadRegistry } from "../lib/romIdentity";
import { readGuideText, writeGuideText } from "../lib/guideStore";
import { reloadPersonalAdventures } from "../lib/personalAdventures";
import { reloadLegacyAdventures } from "../lib/legacyAdventures";
import { reloadTrainerLog } from "../lib/trainerLog";
import { reloadPlayerDex } from "../lib/playerDex";
import { reloadSessions } from "../lib/sessions";
import { reloadChallenges } from "../lib/challenge";
import { adventureLabel } from "../lib/activeAdventure";
import { localeOf, tr, useLang } from "../i18n/lang";

interface Props {
  /** As ROMs que têm arquivos no navegador. */
  roms: string[];
  currentRom?: string;
  /** Depois de restaurar: reler slots, saves e capturas. */
  onRestored: () => void;
}

interface Pendente {
  capsule: Capsule;
  /** O nome sob o qual os arquivos serão gravados neste aparelho. */
  target: string;
  steps: RestoreStep[];
}

/**
 * Exportar e restaurar a cápsula de uma aventura.
 *
 * Restaurar passa sempre por uma prévia: o que a cápsula traz, o que seria
 * substituído e o que fica de fora. E não acontece com aquele jogo aberto — o
 * core está com o save na memória e o regravaria por cima em seguida.
 */
export default function AdventureCapsule({ roms, currentRom, onRestored }: Props) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const inputRef = useRef<HTMLInputElement>(null);
  const [escolhida, setEscolhida] = useState("");
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const rom = roms.includes(escolhida) ? escolhida : (currentRom ?? roms[0]);

  const exportar = async () => {
    if (!rom) return;
    setOcupado(true);
    setAviso(null);
    try {
      const core = await getCore();
      const files = await collectRomFiles(core.FS as unknown as CapsuleFs, core.filePaths(), rom);
      const identity = loadRegistry(localStorage)[rom];
      const guide = await readGuideText(rom).catch(() => null);
      const capsule: Capsule = {
        app: "pokemu-capsule",
        version: 1,
        exportedAt: new Date().toISOString(),
        rom: { fileName: rom, hash: identity?.hash, size: identity?.size },
        adventureId: identity?.adventureId,
        coreVersion: coreVersion(core),
        files,
        data: collectRomData(localStorage, rom),
        ...(guide ? { guide } : {}),
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(capsule)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = capsuleFileName(rom);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setAviso(
        files.some((f) => f.kind === "save")
          ? t(`Cápsula exportada com ${files.length} arquivos.`, `Capsule exported with ${files.length} files.`)
          : t(
              "Cápsula exportada, mas sem save de bateria: este jogo ainda não gravou dentro do jogo.",
              "Capsule exported, but without a battery save: this game hasn't saved in-game yet."
            )
      );
    } catch {
      setAviso(t("Não foi possível montar a cápsula.", "Could not build the capsule."));
    } finally {
      setOcupado(false);
    }
  };

  const ler = async (file: File | undefined) => {
    setPendente(null);
    setAviso(null);
    if (!file) return;
    if (file.size > MAX_CAPSULE_BYTES) {
      setAviso(t("Arquivo grande demais para ser uma cápsula.", "File too large to be a capsule."));
      return;
    }
    const res = await parseCapsule(await file.text());
    if (!res.ok) {
      setAviso(
        res.reason === "corrupt"
          ? t("A cápsula está corrompida: um arquivo não confere com o manifesto. Nada foi alterado.", "The capsule is corrupt: a file doesn't match the manifest. Nothing was changed.")
          : res.reason === "version"
            ? t("Esta cápsula é de uma versão mais nova do Pokemu.", "This capsule is from a newer version of Pokemu.")
            : t("Este arquivo não é uma cápsula de aventura do Pokemu.", "This file isn't a Pokemu adventure capsule.")
      );
      return;
    }
    try {
      const core = await getCore();
      const capsule = res.capsule;
      // Mesmo conteúdo com outro nome neste aparelho: vale o nome daqui.
      const registry = loadRegistry(localStorage);
      const mesmoHash = capsule.rom.hash
        ? Object.entries(registry).find(([, e]) => e.hash === capsule.rom.hash)?.[0]
        : undefined;
      const target = mesmoHash ?? capsule.rom.fileName;
      const existentes = existingSuffixes(core.FS as unknown as CapsuleFs, core.filePaths(), target);
      setPendente({ capsule, target, steps: planRestore(capsule, existentes, coreVersion(core)) });
    } catch {
      setAviso(t("O emulador ainda não está pronto para restaurar.", "The emulator isn't ready to restore yet."));
    }
  };

  const restaurar = async () => {
    if (!pendente) return;
    const { capsule, target, steps } = pendente;
    if (getLoadedRom() === target) {
      setAviso(t("Feche este jogo antes de restaurar a cápsula dele.", "Close this game before restoring its capsule."));
      return;
    }
    setOcupado(true);
    try {
      const core = await getCore();
      // Os arquivos primeiro: se falharem, voltam sozinhos e os dados nem são tocados.
      writeRestore(core.FS as unknown as CapsuleFs, core.filePaths(), target, steps);
      applyRomData(localStorage, target, capsule.data);
      if (capsule.guide) await writeGuideText(target, capsule.guide);
      await core.FSSync();
      reloadPersonalAdventures();
      reloadLegacyAdventures();
      reloadTrainerLog();
      reloadPlayerDex();
      reloadSessions();
      reloadChallenges();
      onRestored();
      setPendente(null);
      setAviso(t(`Aventura de ${adventureLabel(target)} restaurada.`, `${adventureLabel(target)} adventure restored.`));
    } catch {
      setAviso(
        t(
          "A restauração falhou e foi desfeita: a aventura está como antes. Verifique o espaço disponível.",
          "The restore failed and was undone: the adventure is as it was. Check available storage."
        )
      );
    } finally {
      setOcupado(false);
    }
  };

  const conta = (kind: string, action: RestoreStep["action"]) =>
    pendente?.steps.filter((s) => s.file.kind === kind && s.action === action).length ?? 0;
  const substitui = pendente?.steps.filter((s) => s.overwrites).length ?? 0;
  const estadosFora = conta("state", "skip-core");

  return (
    <section className="play-panel">
      <h2>{t("Cápsula da aventura", "Adventure capsule")}</h2>
      <p className="play-panel-hint">
        {t(
          "Um arquivo só com o save, os pontos de retorno, as capturas, o diário e as fichas de um jogo. A ROM não vai junto.",
          "One file with a game's save, save states, screenshots, journal and records. The ROM is not included."
        )}
      </p>
      {roms.length > 0 ? (
        <div className="play-save-actions">
          <label className="visually-hidden" htmlFor="capsule-rom">{t("Jogo da cápsula", "Capsule game")}</label>
          <select id="capsule-rom" value={rom ?? ""} onChange={(e) => setEscolhida(e.target.value)}>
            {roms.map((name) => <option key={name} value={name}>{adventureLabel(name)}</option>)}
          </select>
          <button type="button" onClick={() => void exportar()} disabled={ocupado || !rom}>
            {t("Exportar cápsula", "Export capsule")}
          </button>
        </div>
      ) : (
        <p className="play-panel-hint">{t("Ainda não há jogo com arquivos neste navegador para exportar.", "There's no game with files in this browser to export yet.")}</p>
      )}
      <div className="play-save-actions">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={ocupado}>
          {t("Restaurar cápsula…", "Restore capsule…")}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void ler(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {pendente && (
        <div className="capsule-preview" role="group" aria-label={t("Prévia da restauração", "Restore preview")}>
          <p>
            <strong>{adventureLabel(pendente.capsule.rom.fileName)}</strong>
            {pendente.target !== pendente.capsule.rom.fileName && (
              <> → {t("neste aparelho:", "on this device:")} {adventureLabel(pendente.target)}</>
            )}
          </p>
          <ul>
            <li>
              {t("Exportada em", "Exported on")}{" "}
              {new Date(pendente.capsule.exportedAt).toLocaleString(localeOf(lang))}
            </li>
            <li>
              {conta("save", "write") > 0
                ? t("Traz o save de bateria.", "Includes the battery save.")
                : t("Não traz save de bateria.", "No battery save included.")}
            </li>
            <li>
              {conta("state", "write")} {t("pontos de retorno", "save states")} · {conta("screenshot", "write")}{" "}
              {t("capturas", "screenshots")}
            </li>
            {estadosFora > 0 && (
              <li>
                {t(
                  `${estadosFora} pontos de retorno ficam de fora: foram gravados por outra versão do emulador e podem não abrir.`,
                  `${estadosFora} save states are left out: they were written by another emulator version and may not load.`
                )}
              </li>
            )}
            <li>
              {Object.keys(pendente.capsule.data).length} {t("registros (diário, fichas, histórico)", "records (journal, sheets, history)")}
              {pendente.capsule.guide ? t(" e o detonado", " and the walkthrough") : ""}
            </li>
            <li>
              {substitui > 0
                ? t(`Substitui ${substitui} arquivos que já existem para este jogo, e os registros dele.`, `Replaces ${substitui} existing files for this game, and its records.`)
                : t("Não substitui nenhum arquivo existente.", "Replaces no existing file.")}
            </li>
          </ul>
          <div className="play-save-actions">
            <button type="button" onClick={() => void restaurar()} disabled={ocupado}>
              {t("Restaurar esta aventura", "Restore this adventure")}
            </button>
            <button type="button" className="play-linkish" onClick={() => setPendente(null)}>
              {t("Cancelar", "Cancel")}
            </button>
          </div>
        </div>
      )}
      {aviso && <p className="play-panel-hint" role="status">{aviso}</p>}
    </section>
  );
}
