
import { describeAge } from "../../emulator/saveStates";
import { formatBytes } from "../../emulator/storage";
import ScreenshotThumb from "../../components/ScreenshotThumb";
import SlotName from "../../components/SlotName";
import { localeOf } from "../../i18n/lang";
import type { PlayState } from "./usePlayPage";

export default function SavesPanel({ p }: { p: PlayState }) {
  const { currentRom, emu, en, lang, now, playing, saveInputRef, sidebarArea, tx } = p;
  return (
    <div hidden={sidebarArea !== "saves"}>

          {/* A captura virava download e sumia — mas o PNG ficava no FS e nada
              nunca o apagava, então a cota crescia sozinha e invisível. Aqui
              elas aparecem, dá para baixar de novo, e dá para apagar. */}
          {emu.screenshots.length > 0 && (
            <section className="play-panel">
              <h2>{tx("Capturas", "Screenshots")}</h2>
              <ul className="play-shot-list">
                {emu.screenshots.map((shot) => (
                  <li key={shot.fileName} className="play-shot-row">
                    <ScreenshotThumb
                      fileName={shot.fileName}
                      read={emu.readScreenshot}
                    />
                    <div className="play-shot-info">
                      <span className="play-shot-when">
                        {shot.when.toLocaleString(localeOf(lang))}
                      </span>
                      {shot.size !== undefined && (
                        <span className="play-shot-size">
                          {formatBytes(shot.size)}
                        </span>
                      )}
                    </div>
                    <div className="play-shot-actions">
                      <button
                        type="button"
                        onClick={() => emu.downloadScreenshot(shot.fileName)}
                        title={tx(`Baixar ${shot.fileName}`, `Download ${shot.fileName}`)}
                      >
                        {tx("baixar", "download")}
                      </button>
                      <button
                        type="button"
                        className="play-shot-del"
                        onClick={() => void emu.deleteScreenshot(shot.fileName)}
                        title={tx(`Apagar ${shot.fileName}`, `Delete ${shot.fileName}`)}
                        aria-label={tx(
                          `Apagar captura de ${shot.when.toLocaleString(localeOf(lang))}`,
                          `Delete screenshot from ${shot.when.toLocaleString(localeOf(lang))}`
                        )}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="play-panel">
            <h2>{tx("Pontos de retorno", "Restore points")}</h2>
            <p className="play-panel-hint">{tx("Guarde o momento exato da partida para voltar a ele depois.", "Keep the exact moment in your game to return to it later.")}</p>

            {/* O core vinha capturando um estado a cada 30 s e nunca o
                oferecia. Aqui ele vira o caminho de volta ao jogo. */}
            <div className="play-auto-state">
              <button
                type="button"
                className="play-primary play-resume"
                disabled={!playing || !emu.autoState}
                onClick={emu.loadAutoState}
              >
                ⏱ {tx("Continuar de onde parou", "Continue where you left off")}
              </button>
              <p className="play-panel-hint">
                {!playing
                  ? tx("Carregue um jogo para ver o ponto automático.", "Load a game to see the auto save point.")
                  : emu.autoState
                    ? tx(
                        `Ponto automático de ${formatBytes(emu.autoState.size)}, atualizado a cada 30 s.`,
                        `Auto save point of ${formatBytes(emu.autoState.size)}, updated every 30 s.`
                      )
                    : tx(
                        "Nenhum ponto automático ainda — o primeiro sai em até 30 s.",
                        "No auto save point yet — the first one comes within 30 s."
                      )}
                {playing && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="play-linkish"
                      onClick={() => void emu.captureAutoState()}
                    >
                      {tx("capturar agora", "capture now")}
                    </button>
                  </>
                )}
              </p>
            </div>

            <div className="play-slots">
              {emu.slots.map((info) => (
                <div
                  key={info.slot}
                  className={"play-slot" + (info.exists ? " is-filled" : "")}
                >
                  <span className="play-slot-num">{info.slot}</span>
                  {info.thumbnail ? (
                    <img
                      className="play-slot-thumb"
                      src={info.thumbnail}
                      alt={tx(`Tela gravada no slot ${info.slot}`, `Screen saved in slot ${info.slot}`)}
                    />
                  ) : (
                    <span className="play-slot-thumb is-empty" aria-hidden="true" />
                  )}
                  <span className="play-slot-state">
                    {info.exists ? describeAge(info.modified, now) : tx("vazio", "empty")}
                  </span>
                  <button
                    type="button"
                    disabled={!playing}
                    onClick={() => void emu.saveState(info.slot)}
                    title={
                      info.exists
                        ? tx(`Sobrescrever o slot ${info.slot}`, `Overwrite slot ${info.slot}`)
                        : tx(`Gravar no slot ${info.slot}`, `Save to slot ${info.slot}`)
                    }
                  >
                    {info.exists ? tx("regravar", "overwrite") : tx("gravar", "save")}
                  </button>
                  <button
                    type="button"
                    disabled={!playing || !info.exists}
                    onClick={() => emu.loadState(info.slot)}
                    title={
                      info.exists
                        ? tx(`Carregar do slot ${info.slot}`, `Load from slot ${info.slot}`)
                        : tx(`Slot ${info.slot} está vazio`, `Slot ${info.slot} is empty`)
                    }
                  >
                    {tx("carregar", "load")}
                  </button>
                  <button
                    type="button"
                    className="play-slot-clear"
                    disabled={!playing || !info.exists}
                    onClick={() => void emu.clearState(info.slot)}
                    title={tx(`Apagar o slot ${info.slot}`, `Clear slot ${info.slot}`)}
                    aria-label={tx(`Apagar o slot ${info.slot}`, `Clear slot ${info.slot}`)}
                  >
                    ✕
                  </button>
                  {currentRom && <SlotName key={`${currentRom}:${info.slot}`} rom={currentRom} slot={info.slot} />}
                </div>
              ))}
            </div>
            <p className="play-panel-hint">
              {en
                ? `States are per game: the six slots above belong to ${playing ? currentRom : "whatever game is loaded"}.`
                : `Os estados são por jogo: os seis slots acima são${playing ? ` de ${currentRom}` : " do jogo que estiver carregado"}.`}
            </p>
          </section>

          <section className="play-panel">
            <h2>{tx("Progresso do jogo", "Game progress")}</h2>
            <div className="play-save-actions">
              <button
                type="button"
                disabled={!playing}
                onClick={() => currentRom && emu.exportSave(currentRom)}
              >
                {tx("Exportar .sav", "Export .sav")}
              </button>
              <button
                type="button"
                onClick={() => saveInputRef.current?.click()}
                disabled={emu.status.kind === "unsupported"}
              >
                {tx("Importar…", "Import…")}
              </button>
              <input
                ref={saveInputRef}
                type="file"
                accept=".sav,.ss1,.ss2,.ss3,.ss4,.ss5,.ss6"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void emu.importSave(file);
                  e.target.value = "";
                }}
              />
            </div>
            {emu.saves.length > 0 && (
              <ul className="play-save-list">
                {emu.saves.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
            <p className="play-panel-hint">
              {tx(
                "Saves e estados ficam no IndexedDB deste navegador. Exporte se quiser levar para outra máquina.",
                "Saves and states live in this browser's IndexedDB. Export them to take them to another machine."
              )}
            </p>
          </section>

          <section className="play-panel">
            <h2>{tx("Onde ficam seus saves", "Where your saves live")}</h2>
            <ul className="play-storage">
              <li>
                <span
                  className={
                    "play-dot " +
                    (emu.localSaves !== null ? "is-good" : "is-warn")
                  }
                  aria-hidden="true"
                />
                <div>
                  <strong>{tx("Pasta saves/ no disco", "saves/ folder on disk")}</strong>
                  <p>
                    {emu.localSaves !== null
                      ? tx(
                          "Backup automático a cada gravação do jogo. Esta é a cópia que não depende do navegador.",
                          "Automatic backup every time the game saves. This is the copy that doesn't depend on the browser."
                        )
                      : tx(
                          "Indisponível — só existe em dev e preview. Aqui vale só o IndexedDB; exporte o .sav para ter cópia.",
                          "Unavailable — it only exists in dev and preview. Here only IndexedDB counts; export the .sav to keep a copy."
                        )}
                  </p>
                </div>
              </li>
              <li>
                <span
                  className={
                    "play-dot " +
                    (emu.storage?.persistent ? "is-good" : "is-warn")
                  }
                  aria-hidden="true"
                />
                <div>
                  <strong>
                    {tx("IndexedDB do navegador", "Browser IndexedDB")}
                    {emu.storage
                      ? emu.storage.persistent
                        ? tx(" · persistente", " · persistent")
                        : tx(" · descartável", " · evictable")
                      : ""}
                  </strong>
                  <p>
                    {emu.storage?.persistent
                      ? tx("O navegador prometeu não descartar.", "The browser promised not to evict it.")
                      : tx(
                          "Sobrevive a recarregar e a fechar o navegador, mas pode ser descartado sob pressão de disco, e “limpar dados do site” apaga.",
                          "It survives reloads and closing the browser, but it can be evicted under disk pressure, and “clear site data” deletes it."
                        )}
                    {emu.storage?.usageBytes !== undefined && (
                      <>
                        {" "}
                        {tx("Em uso:", "In use:")} {formatBytes(emu.storage.usageBytes)} {tx("de", "of")}{" "}
                        {formatBytes(emu.storage.quotaBytes)}.
                      </>
                    )}
                  </p>
                </div>
              </li>
            </ul>

            {emu.localSaves !== null && (
              <>
                <button
                  type="button"
                  className="play-backup-btn"
                  disabled={!playing}
                  onClick={() =>
                    currentRom && void emu.backupToDisk(currentRom, { force: true })
                  }
                >
                  {tx("Copiar para saves/ agora", "Copy to saves/ now")}
                </button>
                {emu.localSaves.length > 0 && (
                  <ul className="play-disk-saves">
                    {emu.localSaves.map((s) => (
                      <li key={s.fileName}>
                        <span className="play-disk-name">{s.fileName}</span>
                        <span className="play-disk-meta">
                          {formatBytes(s.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void emu.restoreFromDisk(s.fileName)}
                          title={tx(`Restaurar ${s.fileName} para o emulador`, `Restore ${s.fileName} to the emulator`)}
                        >
                          {tx("restaurar", "restore")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          </div>
  );
}
