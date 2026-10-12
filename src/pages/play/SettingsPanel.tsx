
import {
  GROUP_LABELS,
  GROUP_LABELS_EN,
} from "../../emulator/keyBindings";
import {
  SHORTCUT_HELP,
} from "../../emulator/shortcuts";
import {
  AV_TOGGLES,
  formatLogLine,
  isProblem,
} from "../../emulator/diagnostics";
import { GROUPS } from "./usePlayPage";
import type { PlayState } from "./usePlayPage";

export default function SettingsPanel({ p }: { p: PlayState }) {
  const { capturing, emu, en, gamepadName, setCapturing, sidebarArea, tx } = p;
  return (
    <div hidden={sidebarArea !== "settings"}>
          <section className="play-panel">
            <h2>{tx("Áudio e vídeo", "Audio and video")}</h2>
            <div className="play-av">
              {AV_TOGGLES.map((t) => (
                <label key={t.id} className="play-av-row" title={en ? (t.hintEn ?? t.hint) : t.hint}>
                  <input
                    type="checkbox"
                    checked={emu.av[t.id]}
                    onChange={(e) => emu.setAv({ [t.id]: e.target.checked })}
                  />
                  <span>
                    <strong>{en ? (t.labelEn ?? t.label) : t.label}</strong>
                    <em>{en ? (t.hintEn ?? t.hint) : t.hint}</em>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="play-panel">
            <div className="play-panel-head">
              <h2>{tx("Log do core", "Core log")}</h2>
              {emu.log.length > 0 && (
                <button
                  type="button"
                  className="play-refresh"
                  onClick={emu.clearLog}
                  title={tx("Limpar o log", "Clear the log")}
                >
                  {tx("limpar", "clear")}
                </button>
              )}
            </div>
            {emu.log.length === 0 ? (
              <p className="play-panel-hint">
                {tx(
                  "Nada registrado ainda. O core escreve aqui quando encontra algo fora do comum — é o primeiro lugar a olhar se um jogo se comportar mal.",
                  "Nothing logged yet. The core writes here when it runs into something unusual — the first place to look if a game misbehaves."
                )}
              </p>
            ) : (
              // Rolável: sem foco, quem usa só teclado não consegue rolar.
              <ol className="play-log" tabIndex={0} aria-label={tx("Log do core", "Core log")}>
                {/* Chave pelo `seq` da linha, nunca pelo indice: a janela
                    desliza, e com o indice todos os 80 itens trocavam de chave
                    a cada linha nova — a lista inteira era recriada. */}
                {emu.log.map((line) => (
                  <li
                    key={line.seq}
                    className={isProblem(line.level) ? "is-problem" : ""}
                  >
                    {formatLogLine(line)}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="play-panel">
            <div className="play-panel-head">
              <h2>{tx("Teclas", "Keys")}</h2>
              <button
                type="button"
                className="play-refresh"
                onClick={emu.resetKeyBindings}
                title={tx("Voltar ao mapa padrão", "Back to the default mapping")}
              >
                ↺ {tx("padrão", "default")}
              </button>
            </div>
            <dl className="play-keys">
              {GROUPS.map((group) => (
                <div key={group} className="play-key-group">
                  <dt>{en ? GROUP_LABELS_EN[group] : GROUP_LABELS[group]}</dt>
                  <dd>
                    {emu.bindings
                      .filter((b) => b.group === group)
                      .map((b) => (
                        <button
                          key={b.button}
                          type="button"
                          className={
                            "play-key" +
                            (capturing === b.button ? " is-capturing" : "")
                          }
                          onClick={() =>
                            setCapturing(
                              capturing === b.button ? null : b.button
                            )
                          }
                          title={tx(`Clique e pressione a tecla nova para ${b.button}`, `Click and press the new key for ${b.button}`)}
                        >
                          <kbd>{capturing === b.button ? "…" : b.label}</kbd>
                          {b.button}
                        </button>
                      ))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="play-panel-hint">
              {capturing
                ? tx(`Pressione a tecla para ${capturing} — Esc cancela.`, `Press the key for ${capturing} — Esc cancels.`)
                : tx(
                    "Clique numa tecla para trocá-la. Se a nova já pertencer a outra ação, as duas trocam.",
                    "Click a key to change it. If the new one already belongs to another action, the two swap."
                  )}
            </p>
            <p className="play-panel-hint">
              {gamepadName
                ? `🎮 ${gamepadName}`
                : tx(
                    "Nenhum controle detectado — conecte um e aperte um botão.",
                    "No gamepad detected — connect one and press a button."
                  )}
            </p>

            {/* Atalhos ficam fora da lista remapeável: não são ações do
                console, e remapeá-los é outra conversa. */}
            <dl className="play-keys play-shortcuts">
              <div className="play-key-group">
                <dt>{tx("Atalhos", "Shortcuts")}</dt>
                <dd>
                  {SHORTCUT_HELP.map((s) => (
                    <span key={s.keys} className="play-shortcut">
                      <kbd>{en ? s.keysEn : s.keys}</kbd>
                      {en ? s.whatEn : s.what}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </section>
          </div>
  );
}
