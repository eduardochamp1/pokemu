
import { useState } from "react";
import "../styles/play.css";
import { loadPref, savePref } from "../emulator/prefs";
import PlayAnnouncer from "../components/PlayAnnouncer";
import {
  isTypingTarget,
} from "../emulator/shortcuts";
import {
  SUPPORTED_LABEL,
  SUPPORTED_LABEL_EN,
  consoleOf,
} from "../emulator/types";
import PokedexLink from "../components/PokedexLink";
import { temPokedex } from "../lib/pokedexSite";
import PlayTeam from "../components/PlayTeam";
import LegacySavePanel from "../components/LegacySavePanel";
import GameLibrary from "../components/GameLibrary";
import AdventureJournal from "../components/AdventureJournal";
import WhereILeftOff from "../components/WhereILeftOff";
import IllustratedJournal from "../components/IllustratedJournal";
import { generationLabel } from "../i18n/common";
import { nomeDaRegiao, romano } from "./play/usePlayPage";
import { usePlayPage } from "./play/usePlayPage";
import PlayStage from "./play/PlayStage";
import LibraryTools from "./play/LibraryTools";
import SavesPanel from "./play/SavesPanel";
import SettingsPanel from "./play/SettingsPanel";
import PersistStatus from "../components/PersistStatus";

const PlayPage = () => {
  const p = usePlayPage();
  // Recolher o painel lateral dá a largura toda ao jogo. É preferência do
  // aparelho, como a escala: fica guardada entre visitas.
  const [painelRecolhido, setPainelRecolhido] = useState(() => loadPref("panel-collapsed", (v): v is boolean => typeof v === "boolean") ?? false);
  const alternarPainel = () => {
    setPainelRecolhido((atual) => {
      savePref("panel-collapsed", !atual);
      return !atual;
    });
  };
  const { capturing, currentRom, emu, en, lang, libraryGames, libraryView, playing, romInputRef, setInputEnabled, setSidebarArea, showWorkspace, sidebarArea, tx } = p;
  return (
    <div className="play-shell" onFocusCapture={event => {
      if (isTypingTarget(event.target)) setInputEnabled(false);
    }} onBlurCapture={event => {
      if (isTypingTarget(event.target) && !isTypingTarget(event.relatedTarget) && !libraryView && !capturing) setInputEnabled(true);
    }}>
      <header className="play-header">
        <div>
          <h1>{libraryView ? tx("Biblioteca", "Library") : tx("Sua aventura", "Your adventure")}</h1>
          <p className="play-sub">
            {en
              ? `Your games and progress, together. ${SUPPORTED_LABEL_EN}.`
              : `Seus jogos e seu progresso, juntos. ${SUPPORTED_LABEL}.`}
            {emu.version && <span className="play-core" hidden> {emu.version}</span>}
          </p>
        </div>
        {currentRom !== undefined && !libraryView && (
          <div className="play-now">
            <span className="play-now-label">{emu.status.kind === "paused" ? tx("Em pausa", "Paused") : tx("Rodando", "Running")}</span>
            {/* O nome do arquivo manda na linha principal, e isso é regra, não
                estilo: romhack tem o cabeçalho byte a byte igual ao do jogo
                original, então o detectado só pode vir como base. Escrever
                "FireRed" em cima de um Unbound seria mentir. */}
            <strong>{currentRom}</strong>
            <span className="play-now-console">
              {emu.romId
                ? `${emu.romId.console} · base: ${emu.romId.jogo} · ${generationLabel(emu.romId.geracao, lang)}`
                : consoleOf(currentRom)}
            </span>
            {/* As três páginas ficam na Pokédex, que é outro site: sem o
                endereço dela configurado, a barra nem aparece. */}
            {emu.romId && temPokedex && (
              <nav className="play-now-links" aria-label={tx("Sobre este jogo", "About this game")}>
                {/* "Geração III" é fato; "a dex de Emerald" seria aproximação:
                    FireRed e LeafGreen usam a dex de Kanto mas trazem espécies
                    de Johto no pós-jogo. */}
                <PokedexLink to={`/?ger=${emu.romId.geracao}`}>
                  {en
                    ? `Generation ${romano(emu.romId.geracao)} Pokémon`
                    : `Pokémon da Geração ${romano(emu.romId.geracao)}`}
                </PokedexLink>
                <PokedexLink to={`/mapa?region=${emu.romId.regiaoId}`}>
                  {nomeDaRegiao(emu.romId.regiaoId)} {tx("no mapa", "on the map")}
                </PokedexLink>
                <PokedexLink to="/lore?aba=generations">{tx("Geração na lore", "Generation in the lore")}</PokedexLink>
              </nav>
            )}
          </div>
        )}
      </header>
      <div className="workspace-row">
        <nav className="workspace-nav" aria-label={tx("Área de jogos", "Game workspace")}>
          <button aria-current={libraryView ? "page" : undefined} onClick={() => showWorkspace("biblioteca")}>{tx("Biblioteca", "Library")} <span>{libraryGames.length}</span></button>
          <button aria-current={!libraryView ? "page" : undefined} onClick={() => showWorkspace("jogar")}>{tx("Jogar", "Play")}{playing && <span>●</span>}</button>
        </nav>
        {!libraryView && (
          <button type="button" className="panel-toggle" aria-pressed={painelRecolhido} onClick={alternarPainel}>
            {painelRecolhido ? tx("Mostrar o painel", "Show the panel") : tx("Só o jogo", "Game only")}
          </button>
        )}
      </div>

      {emu.status.kind === "unsupported" && (
        <section className="play-diag" role="alert">
          <h2>{emu.status.reason}</h2>
          <p>{emu.status.detail}</p>
          <p className="play-diag-fix">
            {en ? (
              <>
                With <code>npm run dev</code> and <code>npm run preview</code> the headers
                are already set in <code>vite.config.ts</code>. If you opened{" "}
                <code>dist/</code> through another server, it has to send the same two
                headers — see <code>public/_headers</code>.
              </>
            ) : (
              <>
                Em <code>npm run dev</code> e <code>npm run preview</code> os headers
                já vão configurados no <code>vite.config.ts</code>. Se você abriu o{" "}
                <code>dist/</code> por outro servidor, ele precisa mandar os mesmos
                dois headers — veja <code>public/_headers</code>.
              </>
            )}
          </p>
        </section>
      )}

      {emu.status.kind === "error" && (
        <section className="play-diag play-diag-error" role="alert">
          <h2>{tx("Falhou", "Failed")}</h2>
          <p>{emu.status.message}</p>
        </section>
      )}

      {emu.contentChange && (
        <section className="play-diag" role="group" aria-label={tx("Conteúdo novo com nome conhecido", "New content under a known name")}>
          <p>
            {tx(
              `Continuar a aventura de "${emu.contentChange.rom}" com este arquivo? O save atual será usado por ele.`,
              `Continue the "${emu.contentChange.rom}" adventure with this file? The current save will be used by it.`
            )}
          </p>
          <button type="button" onClick={emu.confirmContentChange}>{tx("É o mesmo jogo, continuar", "Same game, continue")}</button>{" "}
          <button type="button" className="play-linkish" onClick={emu.cancelContentChange}>{tx("Cancelar", "Cancel")}</button>
        </section>
      )}

      {playing && currentRom && <PersistStatus rom={currentRom} onRetry={() => void emu.sync()} onExport={emu.exportSave} />}

      <PlayAnnouncer status={emu.status} notice={emu.notice} />
      {/* Sem role: quem anuncia o aviso é o PlayAnnouncer, que está sempre
          montado — este div nasce já com o texto e seria anunciado duas vezes. */}
      {emu.notice && (
        <div className="play-notice">
          {emu.notice}
          <button type="button" onClick={emu.dismissNotice} aria-label={tx("Fechar", "Close")}>
            ✕
          </button>
        </div>
      )}

      <div hidden={!libraryView}><GameLibrary games={libraryGames} currentRom={currentRom} loading={emu.status.kind === "checking" || emu.status.kind === "loading" || emu.status.kind === "unsupported"}
        onPlay={game => {
          showWorkspace("jogar");
          if (game.fileName !== currentRom) {
            if (game.local) void emu.playLocal(game.fileName);
            else void emu.playStored(game.fileName);
          }
        }}
        onContinue={() => showWorkspace("jogar")}
        onImport={() => romInputRef.current?.click()}
        onRefresh={() => void emu.refreshLocalRoms()} /></div>
      <div className={"play-layout" + (painelRecolhido ? " is-collapsed" : "")} hidden={libraryView}>
        <PlayStage p={p} />

        <aside className="play-sidebar">
          <nav className="sidebar-nav" aria-label={tx("Painel da partida", "Game panel")}>
            {([ ["adventure", tx("Aventura", "Adventure")], ["saves", tx("Saves", "Saves")], ["settings", tx("Ajustes", "Settings")] ] as const).map(([area, label]) => <button key={area} aria-current={sidebarArea === area ? "page" : undefined} onClick={() => setSidebarArea(area)}>{label}</button>)}
          </nav>
          <div hidden={sidebarArea !== "adventure"}>
          <LibraryTools p={p} />
          {/* O save vira fonte de dados do site: os ids nacionais saem
              dele e entram no mesmo hook que a grade usa. */}
          {emu.legacySave ? <LegacySavePanel save={emu.legacySave} /> : <PlayTeam team={emu.team} lido={emu.teamLido} />}
          {currentRom && <WhereILeftOff key={`recap:${currentRom}`} rom={currentRom} />}
          {currentRom && <AdventureJournal key={currentRom} rom={currentRom} />}
          {currentRom && (
            <IllustratedJournal rom={currentRom} screenshots={emu.screenshots} readScreenshot={emu.readScreenshot} />
          )}
          </div>
          <SavesPanel p={p} />
          <SettingsPanel p={p} />
        </aside>
      </div>
    </div>
  );
};

export default PlayPage;
