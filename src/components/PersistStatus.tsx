import { useDurability, type Durability } from "../emulator/durability";
import { localeOf, tr, useLang } from "../i18n/lang";

interface Props {
  /** O jogo aberto, para a exportação de emergência. */
  rom: string;
  onRetry: () => void;
  onExport: (rom: string) => void;
}

/**
 * Onde o progresso está guardado, e desde quando. Navegador e disco aparecem
 * separados: o espelho em `saves/` só existe em dev/preview, e no modo web a
 * tela não sugere que ele existe. Uma falha fica à vista até a próxima
 * gravação dar certo, com a saída de emergência ao lado.
 */
export default function PersistStatus({ rom, onRetry, onExport }: Props) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const { browser, disk } = useDurability();
  const hora = (ms?: number) =>
    ms === undefined ? "" : new Date(ms).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const linha = (d: Durability, onde: string) => {
    switch (d.state) {
      case "saving":
        return t(`Gravando no ${onde}…`, `Saving to ${onde}…`);
      case "pending":
        return d.error
          ? t(`Falhou ao gravar no ${onde}; tentando de novo.`, `Saving to ${onde} failed; retrying.`)
          : t(`Gravação no ${onde} na fila.`, `Save to ${onde} queued.`);
      case "failed":
        return t(`Não foi possível gravar no ${onde}: ${d.error ?? ""}`, `Couldn't save to ${onde}: ${d.error ?? ""}`);
      case "saved":
        return t(`Guardado no ${onde} às ${hora(d.lastOk)}.`, `Saved to ${onde} at ${hora(d.lastOk)}.`);
      default:
        return null;
    }
  };

  const navegador = linha(browser, t("navegador", "browser"));
  const emDisco = disk.available ? linha(disk, t("disco (saves/)", "disk (saves/)")) : null;
  const falhou = browser.state === "failed";
  if (!navegador && !emDisco) return null;

  return (
    <div className={"play-persist" + (falhou ? " is-failed" : "")} role={falhou ? "alert" : "status"}>
      {navegador && <span>{navegador}</span>}
      {emDisco && <span>{emDisco}</span>}
      {falhou && (
        <span className="play-save-actions">
          <button type="button" onClick={onRetry}>{t("Tentar de novo", "Try again")}</button>
          <button type="button" onClick={() => onExport(rom)}>{t("Exportar o save agora", "Export the save now")}</button>
        </span>
      )}
    </div>
  );
}
