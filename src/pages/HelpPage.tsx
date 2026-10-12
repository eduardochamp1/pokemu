import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getLoadedRom } from "../emulator/core";
import { compareRomsChronologically } from "../emulator/romChronology";
import { useTrainerEntries } from "../lib/trainerLog";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { usePersonalAdventures, usePersonalAdventure, updatePersonalAdventure, validPersonalAdventure } from "../lib/personalAdventures";
import { setActiveAdventure, useActiveAdventure } from "../lib/activeAdventure";
import { useGuideText, writeGuideText } from "../lib/guideStore";
import { useT } from "../i18n/lang";
import AdventureJournal from "../components/AdventureJournal";
import WalkthroughSources from "../components/WalkthroughSources";
import ProgressiveHints from "../components/ProgressiveHints";
import "../styles/trainer.css";
import "../styles/journal.css";

export default function HelpPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const trainerEntries = useTrainerEntries();
  const legacyEntries = useLegacyAdventures();
  const personal = usePersonalAdventures();
  const [local, setLocal] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/local-roms.json").then(response => response.ok ? response.json() : []).then((entries: unknown) => {
      if (active && Array.isArray(entries)) setLocal(entries.flatMap(entry => entry && typeof entry.fileName === "string" ? [entry.fileName] : []));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const activeRom = useActiveAdventure();
  const requested = params.get("rom") ?? activeRom ?? getLoadedRom() ?? "";
  const roms = [...new Set([...local, ...trainerEntries.map(entry => entry.rom), ...legacyEntries.map(entry => entry.rom), ...personal.map(entry => entry.rom), ...(requested ? [requested] : [])])].map(fileName => ({ fileName })).sort(compareRomsChronologically);
  const rom = requested || roms[0]?.fileName;
  const saved = trainerEntries.find(entry => entry.rom === rom);
  const legacy = legacyEntries.find(entry => entry.rom === rom);
  const badges = saved?.trainer.badges ?? legacy?.save.trainer.badges;
  return <div className="trainer-shell">
    <header className="trainer-header"><h1>{t("Ajuda e detonados", "Help and walkthroughs")}</h1></header>
    <p className="trainer-sub">{t("Busque o obstáculo, consulte dicas sem abrir todos os spoilers e registre o que quer tentar.", "Search for an obstacle, read hints without revealing every spoiler and record your next step.")}</p>
    <label className="page-selector">{t("Jogo da biblioteca", "Library game")}<select value={rom ?? ""} onChange={event => { setActiveAdventure(event.target.value); setParams({ rom: event.target.value }); }}>{!roms.length && <option value="">{t("Adicione um jogo à biblioteca", "Add a game to the library")}</option>}{roms.map(entry => <option key={entry.fileName} value={entry.fileName}>{entry.fileName}</option>)}</select></label>
    {!rom ? <p className="page-scope"><Link to="/">{t("Abrir biblioteca →", "Open library →")}</Link></p> : <>
      <p className="page-scope">{badges ? t(`Último save lido: ${badges.filter(Boolean).length} de ${badges.length} insígnias.`, `Last recorded save: ${badges.filter(Boolean).length} of ${badges.length} badges.`) : t("Ainda não há progresso válido lido para este jogo.", "No valid progress has been read for this game yet.")} {t("A ajuda usa o último save e seus objetivos; a localização atual não é detectada aqui.", "Help uses your last save and goals; current location is not detected here.")}</p>
      <WalkthroughSources rom={rom} />
      <ProgressiveHints key={`hints:${rom}`} rom={rom} badges={badges} />
      <GuideReader key={rom} rom={rom} />
      <AdventureJournal key={`journal:${rom}`} rom={rom} />
    </>}
  </div>;
}

function GuideReader({ rom }: { rom: string }) {
  const t = useT();
  const entry = usePersonalAdventure(rom);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(entry.guide?.source ?? "");
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(30);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Guia ainda não migrado traz o texto junto; os demais vêm do IndexedDB.
  const stored = useGuideText(entry.guide && entry.guide.text === undefined ? rom : undefined);
  const guideText = entry.guide?.text ?? stored ?? "";
  const sections = guideText.split(/\n\s*\n|\n(?=#{1,6}\s)/).map(text => text.trim()).filter(Boolean);
  const matches = sections.filter(text => normalize(text).includes(normalize(query)));
  const importGuide = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      if (!/\.(txt|md)$/i.test(file.name) || file.size > 1_200_000) throw new Error("format");
      const text = (await file.text()).replace(/\r\n?/g, "\n").trim();
      if (!text || text.length > 300_000 || text.includes("\0")) throw new Error("format");
      const guide = { title: file.name.slice(0, 200), source: source.trim(), chars: text.length };
      // Valida antes de tocar no banco: uma fonte inválida não pode custar o
      // texto do guia que já estava lá. Depois o texto, e só então a ficha.
      if (!validPersonalAdventure({ ...entry, rom, guide })) throw new Error("format");
      await writeGuideText(rom, text);
      updatePersonalAdventure(rom, { guide });
      setQuery(""); setLimit(30);
    } catch { setError(t("Não foi possível guardar. Use TXT ou Markdown com até 300 mil caracteres, fonte http/https e espaço disponível no armazenamento.", "Could not save. Use TXT or Markdown up to 300,000 characters, an http/https source and available storage.")); }
  };
  return <section className="adventure-journal">
    <h2>{t("Detonado deste jogo", "This game's walkthrough")}</h2>
    {entry.guide ? <>
      <p>{entry.guide.title}</p>
      {entry.guide.source && <a className="journal-help" href={entry.guide.source} target="_blank" rel="noopener noreferrer">{t("Consultar fonte ↗", "View source ↗")}</a>}
      <label>{t("Buscar cidade, item ou obstáculo", "Search town, item or obstacle")}<input className="help-search" type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); }} /></label>
      <p className="trainer-sub">{matches.length} {t("trechos encontrados. Abra só o que quiser revelar.", "passages found. Open only what you want to reveal.")}</p>
      {matches.slice(0, limit).map((text, index) => <details key={`${query}:${index}`} className="guide-result"><summary>{text.split("\n")[0].replace(/^#+\s*/, "").slice(0, 100)}</summary><p className="guide-text">{text}</p></details>)}
      {matches.length > limit && <button onClick={() => setLimit(limit + 30)}>{t("Mostrar mais trechos", "Show more passages")}</button>}
    </> : <p className="page-scope">{t("Nenhum detonado foi cadastrado para esta ROM. Importe seu texto abaixo; ele ficará disponível neste dispositivo e no backup de aventuras.", "No walkthrough has been added for this ROM. Import your text below; it will be available on this device and in the adventure backup.")}</p>}
    <details><summary>{entry.guide ? t("Substituir detonado", "Replace walkthrough") : t("Cadastrar detonado", "Add walkthrough")}</summary>
      <p className="trainer-sub">{t("Use um texto próprio ou autorizado. TXT e Markdown são exibidos como texto, sem executar HTML. O arquivo escolhido substitui o guia deste jogo.", "Use your own or authorized text. TXT and Markdown display as text without executing HTML. The selected file replaces this game's guide.")}</p>
      <label>{t("Link da fonte (opcional)", "Source link (optional)")}<input className="help-search" type="url" value={source} onChange={event => setSource(event.target.value)} placeholder="https://" /></label>
      <label>{t("Arquivo do detonado (.txt ou .md)", "Walkthrough file (.txt or .md)")}<input type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event => { void importGuide(event.target.files?.[0]); event.target.value = ""; }} /></label>
    </details>
    {error && <p role="alert">{error}</p>}
    <details><summary>{t("Checklist quando travar", "Checklist when stuck")}</summary><ul><li>{t("Anote onde parou e o que já tentou no diário abaixo.", "Record where you stopped and what you tried in the journal below.")}</li><li>{t("Pesquise no guia pelo nome do local ou pelo item que falta.", "Search the guide for the location name or missing item.")}</li><li>{t("Crie um ponto de retorno com nome antes de testar outra estratégia.", "Create a named restore point before trying another strategy.")}</li></ul><Link className="journal-help" to="/?area=jogar&painel=saves">{t("Abrir pontos de retorno →", "Open restore points →")}</Link></details>
  </section>;
}
