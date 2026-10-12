
import {
  TOUCH_BUTTONS,
} from "../../emulator/keyBindings";
import { padLabel } from "../../emulator/announce";
import {
  TURBO_MULTIPLIER,
  VELOCIDADE_MAX,
  VELOCIDADE_MIN,
} from "../../emulator/shortcuts";
import { SCALE_MODES } from "../../emulator/display";
import { rewindSeconds } from "../../emulator/capture";
import { teclaDoTurbo } from "./usePlayPage";
import type { PlayState } from "./usePlayPage";

export default function PlayStage({ p }: { p: PlayState }) {
  const { currentRom, display, dragging, emu, en, focarPalco, lang, onDrop, playing, screenRef, setDragging, tx } = p;
  return (
    <div className="play-stage">
          {/* Carcaca: lente, LEDs e grelha em volta da tela. E moldura —
              nada aqui recebe foco nem cobre o canvas. */}
          <div className="play-deck" aria-hidden="true">
            <span className="play-deck-lens" />
            <span className="play-deck-leds">
              <span />
              <span />
              <span />
            </span>
            <span className="play-deck-grille" />
          </div>
          <div
            ref={screenRef}
            className={
              "play-screen" +
              (dragging ? " is-dragging" : "") +
              (display.isFullscreen ? " is-fullscreen" : "")
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {/* O canvas é criado fora do React e adotado aqui pelo hook: o
                core é amarrado a ele na criação e retido pela sessão. */}
            {/* `tabIndex={-1}`: focável por código, fora da ordem do Tab —
                o palco não é um controle. Ver `focarPalco`. */}
            <div
              ref={emu.stageRef}
              className="play-canvas-host"
              tabIndex={-1}
              onMouseDown={focarPalco}
            />

            {!playing && (
              <div className="play-screen-overlay">
                {emu.status.kind === "loading" ? (
                  <p>{tx("Carregando…", "Loading…")}</p>
                ) : emu.status.kind === "ready" ? (
                  <>
                    <p className="play-overlay-title">{tx("Nenhum jogo carregado", "No game loaded")}</p>
                    <p className="play-overlay-hint">
                      {tx(
                        "Arraste uma ROM aqui, escolha um arquivo ou pegue da sua biblioteca ao lado.",
                        "Drag a ROM here, pick a file or take one from your library on the side."
                      )}
                    </p>
                    <p className="play-overlay-hint">
                      {tx(
                        "ROM é a cópia em arquivo de um cartucho (.gb, .gbc ou .gba). O site não traz nenhuma: você usa as suas.",
                        "A ROM is a cartridge copied to a file (.gb, .gbc or .gba). The site ships none: you bring your own."
                      )}
                    </p>
                  </>
                ) : emu.status.kind === "checking" ? (
                  <p>{tx("Verificando o navegador…", "Checking the browser…")}</p>
                ) : null}
              </div>
            )}

            {/* Em tela cheia os controles da página somem junto com ela: a
                saída precisa estar dita aqui dentro. */}
            {display.isFullscreen && (
              <p className="play-fs-hint">{tx("Esc para sair da tela cheia", "Esc to exit full screen")}</p>
            )}
          </div>

          {playing && (
            <>
              {/* Depois de acionar um controle o teclado volta para o jogo. */}
              <div className="play-controls" onClick={focarPalco}>
                {emu.status.kind === "running" ? (
                  <button type="button" onClick={emu.pause}>
                    ⏸ {tx("Pausar", "Pause")}
                  </button>
                ) : (
                  <button type="button" onClick={emu.resume}>
                    ▶ {tx("Continuar", "Resume")}
                  </button>
                )}
                {/* Segurar, não alternar: rebobinar é correção de curso —
                    você volta olhando a tela e solta no ponto certo. */}
                <button
                  type="button"
                  className={
                    "play-rewind" + (emu.rewinding ? " is-rewinding" : "")
                  }
                  title={tx(
                    `Segure (ou segure a tecla R) para voltar no tempo (até ${rewindSeconds()} s)`,
                    `Hold (or hold the R key) to go back in time (up to ${rewindSeconds()} s)`
                  )}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    emu.setRewinding(true);
                  }}
                  onPointerUp={() => emu.setRewinding(false)}
                  onPointerLeave={() => emu.setRewinding(false)}
                  onPointerCancel={() => emu.setRewinding(false)}
                >
                  ⏪ {tx("Rebobinar", "Rewind")}
                </button>
                {/* Só aparece no toque (ver play.css): lá não há Espaço para
                    segurar, e o turbo simplesmente não existia. */}
                <button
                  type="button"
                  className={"play-turbo-btn" + (emu.turboActive ? " is-on" : "")}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    emu.setTurbo(true);
                  }}
                  onPointerUp={() => emu.setTurbo(false)}
                  onPointerLeave={() => emu.setTurbo(false)}
                  onPointerCancel={() => emu.setTurbo(false)}
                >
                  ⏩ Turbo
                </button>
                <button
                  type="button"
                  onClick={() => currentRom && void emu.takeScreenshot(currentRom)}
                >
                  📷 {tx("Capturar", "Screenshot")}
                </button>
                <button type="button" onClick={emu.reset}>
                  ↺ {tx("Reiniciar", "Reset")}
                </button>
                <button type="button" onClick={emu.stop}>
                  ⏹ {tx("Fechar jogo", "Close game")}
                </button>
                <button type="button" onClick={() => void emu.sync()}>
                  💾 {tx("Sincronizar", "Sync")}
                </button>
                {display.fullscreenSupported && (
                  <button
                    type="button"
                    className="play-fs-btn"
                    onClick={() => void display.toggleFullscreen()}
                  >
                    {display.isFullscreen
                      ? tx("⤡ Sair da tela cheia", "⤡ Exit full screen")
                      : tx("⛶ Tela cheia", "⛶ Full screen")}
                  </button>
                )}

                <div
                  className="play-scale"
                  role="group"
                  aria-label={tx("Escala da tela", "Screen scale")}
                >
                  <span className="play-scale-label">{tx("Escala", "Scale")}</span>
                  {SCALE_MODES.map((mode) => (
                    <button
                      key={String(mode.id)}
                      type="button"
                      className={
                        "play-scale-btn" +
                        (display.scaleMode === mode.id ? " is-active" : "")
                      }
                      aria-pressed={display.scaleMode === mode.id}
                      title={en ? mode.titleEn : mode.title}
                      onClick={() => display.setScaleMode(mode.id)}
                    >
                      {en ? mode.labelEn : mode.label}
                    </button>
                  ))}
                  {display.scaleLabel && (
                    <span className="play-scale-now">{display.scaleLabel}</span>
                  )}
                </div>

                <label className="play-slider">
                  Volume
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={emu.volume}
                    onChange={(e) => emu.setVolume(Number(e.target.value))}
                  />
                  <span>{emu.volume}%</span>
                </label>

                {/* A régua voltou junto com o core 2.5.0: na 2.5.1 o
                    `setFastForwardMultiplier` estava quebrado e pedir 5× ou
                    metade dava 1× igual, então ela mentia. Medido agora, o
                    core obedece — ver a tabela em shortcuts.ts. */}
                <label className="play-slider play-speed">
                  {tx("Velocidade", "Speed")}
                  <input
                    type="range"
                    min={VELOCIDADE_MIN}
                    max={VELOCIDADE_MAX}
                    step={1}
                    value={emu.fastForward}
                    disabled={emu.turboActive}
                    onChange={(e) => emu.setFastForward(Number(e.target.value))}
                  />
                  <span className={emu.turboActive ? "is-overridden" : ""}>
                    {emu.fastForward}×
                  </span>
                </label>

                <span
                  className={
                    "play-turbo" + (emu.turboActive ? " is-on" : "")
                  }
                  role="status"
                >
                  {emu.turboActive
                    ? `Turbo ${TURBO_MULTIPLIER}×`
                    : en
                      ? `Hold ${teclaDoTurbo(emu.bindings, lang)} for turbo`
                      : `Segure ${teclaDoTurbo(emu.bindings, lang)} para o turbo`}
                </span>
              </div>

              {/* Gamepad virtual: sem ele o jogo é injogável no toque. */}
              <div className="play-gamepad" aria-label={tx("Controle virtual", "Virtual gamepad")}>
                {TOUCH_BUTTONS.map((b) => (
                  <button
                    key={b.button}
                    type="button"
                    className={"play-pad play-pad-" + b.area}
                    aria-label={padLabel(b.button, lang)}
                    // Fora da ordem do Tab: é controle de toque. No teclado o
                    // jogo já tem as próprias teclas, e um botão focável que
                    // Enter não aciona é uma armadilha.
                    tabIndex={-1}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      emu.pressButton(b.button);
                    }}
                    onPointerUp={() => emu.releaseButton(b.button)}
                    onPointerLeave={() => emu.releaseButton(b.button)}
                    onPointerCancel={() => emu.releaseButton(b.button)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
  );
}
