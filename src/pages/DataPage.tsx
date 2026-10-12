import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  applyBackup,
  backupFileName,
  collectBackup,
  parseBackup,
  summarize,
  type Backup,
  type BackupSummary,
} from "../lib/backup";
import { useLang, tr, localeOf } from "../i18n/lang";
import "../styles/trainer.css";
import "../styles/data.css";

/** O `localStorage` pode não existir (modo privado restrito). */
function armazenamento(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const Resumo = ({ r }: { r: BackupSummary }) => {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  return (
    <ul className="dados-resumo">
      <li>
        <strong>{r.trainerCards}</strong> {t("fichas de treinador", "trainer cards")}
      </li>
      <li>
        <strong>{r.playerDexes}</strong> {t("Pokédex de jogo", "game Pokédexes")}
      </li>
      <li>
        <strong>{r.other}</strong> {t("preferências e recordes", "preferences and records")}
      </li>
    </ul>
  );
};

/**
 * Seus dados: o que o site guarda neste navegador, para levar a outro
 * aparelho num arquivo — sem conta e sem servidor.
 */
const DataPage = () => {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const s = armazenamento();
  const atual = useMemo(() => {
    try { return s ? collectBackup(s) : null; } catch { return null; }
  }, [s]);
  const [vindo, setVindo] = useState<{ nome: string; backup: Backup } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const exportar = () => {
    if (!s) return;
    setErro(null);
    try {
      const b = collectBackup(s);
      const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 1)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = backupFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErro(t("Não foi possível exportar os dados. Verifique o acesso ao armazenamento e tente novamente.", "Could not export data. Check storage access and try again."));
    }
  };

  const ler = async (f: File | undefined) => {
    setErro(null);
    setVindo(null);
    if (!f) return;
    let b: Backup | null;
    try { b = parseBackup(await f.text()); } catch {
      setErro(t("Não foi possível ler o arquivo. Escolha o backup novamente.", "Could not read the file. Select the backup again."));
      return;
    }
    if (!b) {
      setErro(t("Este arquivo não é um backup de aventuras do Pokemu.", "This file isn't a Pokemu adventure backup."));
      return;
    }
    setVindo({ nome: f.name, backup: b });
  };

  const importar = () => {
    if (!s || !vindo) return;
    try { applyBackup(s, vindo.backup); } catch (error) {
      setErro(error instanceof Error && error.message === "Backup restore and rollback failed"
        ? t("A restauração falhou e não foi possível repor todos os dados anteriores. Mantenha seus arquivos de backup e confira o armazenamento disponível.", "Restore failed and some previous data could not be recovered. Keep your backup files and check available storage.")
        : t("Não foi possível restaurar o backup. Os dados anteriores foram mantidos; verifique o espaço disponível.", "Could not restore the backup. Previous data was retained; check available storage."));
      return;
    }
    // Os stores leem o localStorage ao carregar: recarregar é o jeito honesto
    // de todas as páginas verem os dados novos.
    window.location.reload();
  };

  if (!s || !atual) {
    return (
      <div className="trainer-shell">
        <h1>{t("Backup e restauração", "Backup and restore")}</h1>
        <p className="trainer-vazio">
          {t("Este navegador não deixa o site guardar dados (modo privado?).", "This browser doesn't let the site store data (private mode?).")}
        </p>
      </div>
    );
  }

  return (
    <div className="trainer-shell">
      <header className="trainer-header">
        <h1>{t("Backup e restauração", "Backup and restore")}</h1>
      </header>
      <p className="trainer-sub">
        {t(
          "Exporte histórico, fichas, diário, objetivos, favoritos, nomes dos pontos de retorno e detonados cadastrados em um arquivo JSON. Ele não inclui ROMs, saves .sav nem os arquivos dos pontos de retorno da partida.",
          "Export history, cards, journal, goals, favorites, restore point names and imported walkthroughs as JSON. It does not include ROMs, .sav saves or actual game restore point files."
        )}
      </p>
      <p className="page-scope">{t("Para guardar o progresso jogável, exporte também o save .sav na área de jogo.", "To keep playable progress, also export the .sav save from the game workspace.")}{" "}<Link to="/?area=jogar&painel=saves">{t("Abrir saves →", "Open saves →")}</Link></p>
      {erro && <p className="dados-erro" role="alert">{erro}</p>}

      <section className="dados-bloco" aria-labelledby="dados-exportar">
        <h2 id="dados-exportar">{t("Neste navegador", "In this browser")}</h2>
        <Resumo r={summarize(atual.data)} />
        <button type="button" onClick={exportar}>
          {t("Exportar para arquivo", "Export to file")}
        </button>
      </section>

      <section className="dados-bloco" aria-labelledby="dados-importar">
        <h2 id="dados-importar">{t("Trazer de outro aparelho", "Bring from another device")}</h2>
        <label className="dados-arquivo">
          {t("Arquivo exportado (.json)", "Exported file (.json)")}
          <input type="file" accept=".json,application/json" onChange={(e) => void ler(e.target.files?.[0])} />
        </label>
        {vindo && (
          <div className="dados-confirmar">
            <p>
              {vindo.nome} ·{" "}
              {t("exportado em", "exported on")}{" "}
              {new Date(vindo.backup.exportedAt).toLocaleString(localeOf(lang))}
            </p>
            <Resumo r={summarize(vindo.backup.data)} />
            <p className="trainer-sub">
              {t(
                "Importar substitui os dados deste navegador pelos do arquivo. Se quiser guardar os daqui, exporte antes.",
                "Importing replaces this browser's data with the file's. If you want to keep the ones here, export first."
              )}
            </p>
            <div className="dados-acoes">
              <button type="button" className="dados-perigo" onClick={importar}>
                {t("Substituir e recarregar", "Replace and reload")}
              </button>
              <button type="button" onClick={() => setVindo(null)}>
                {t("Cancelar", "Cancel")}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default DataPage;
