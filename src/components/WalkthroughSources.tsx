import { walkthroughSources } from "../data/walkthroughSources";
import { useT } from "../i18n/lang";

export default function WalkthroughSources({ rom }: { rom: string }) {
  const t = useT();
  const sources = walkthroughSources(rom);
  return <section className="adventure-journal" aria-label={t("Guias na internet", "Online guides")}>
    <h2>{t("Guias na internet", "Online guides")}</h2>
    <p className="trainer-sub">{t("Consulte as fontes deste jogo. Os links abrem em outra aba e precisam de internet; os sites podem conter spoilers.", "Browse this game's sources. Links open in another tab and require internet; sites may contain spoilers.")}</p>
    {sources.length ? <ul className="walkthrough-sources">{sources.map(source => <li key={source.url}>
      <a className="journal-help" href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
      <p>{t(source.scope, source.scopeEn)} · {source.language === "pt" ? t("Português", "Portuguese") : t("Inglês", "English")}</p>
      {source.note && <p className="trainer-sub">{t(source.note, source.noteEn ?? source.note)}</p>}
    </li>)}</ul> : <p className="page-scope">{t("Ainda não há fontes catalogadas para este nome de ROM. Você pode cadastrar um guia próprio abaixo.", "No sources have been catalogued for this ROM name yet. You can add your own guide below.")}</p>}
    <p className="trainer-sub">{t("Associação sugerida pelo nome do arquivo. Confirme a edição e a versão na fonte. Levantamento: 12/10/2026.", "Suggested match by file name. Confirm the edition and version at the source. Researched: 12 October 2026.")}</p>
  </section>;
}
