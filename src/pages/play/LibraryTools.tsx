
import { compareRomsChronologically, romRelease } from "../../emulator/romChronology";
import {
  consoleOf,
} from "../../emulator/types";
import { formatBytes } from "../../emulator/storage";
import type { PlayState } from "./usePlayPage";

export default function LibraryTools({ p }: { p: PlayState }) {
  const { currentRom, emu, en, removing, romInputRef, romPedida, setRemoving, showWorkspace, tx } = p;
  return (
    <details className="play-library-tools">
            <summary>{tx("Trocar ou adicionar jogo", "Change or add a game")}</summary>
          <section className="play-panel">
            <h2>{tx("Trocar de jogo", "Change game")}</h2>
            <button
              type="button"
              className="play-primary"
              onClick={() => romInputRef.current?.click()}
              // Antes de o core subir, `playFile` não tem para onde mandar o
              // arquivo e saía em silêncio.
              disabled={
                emu.status.kind === "unsupported" ||
                emu.status.kind === "checking" ||
                emu.status.kind === "loading"
              }
            >
              {tx("Escolher arquivo…", "Choose file…")}
            </button>
            <input
              ref={romInputRef}
              type="file"
              accept=".gb,.gbc,.gba"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { showWorkspace("jogar"); void emu.playFile(file); }
                e.target.value = "";
              }}
            />
            <p className="play-panel-hint">
              {tx(
                "O arquivo fica guardado no navegador — na próxima visita ele aparece em “Na sua biblioteca”.",
                "The file is kept in the browser — next visit it shows up under “In your library”."
              )}
            </p>
          </section>

          <section className="play-panel">
            <div className="play-panel-head">
              <h2>{tx("Jogos do computador", "Games on this computer")}</h2>
              {/* Reler não faz sentido onde a pasta não existe (produção). */}
              {emu.localRoms !== null && (
                <button
                  type="button"
                  className="play-refresh"
                  onClick={() => void emu.refreshLocalRoms()}
                  title={tx("Reler a pasta roms/", "Re-read the roms/ folder")}
                >
                  ↻ {tx("atualizar", "refresh")}
                </button>
              )}
            </div>
            {emu.localRoms === null ? (
              <p className="play-empty-folder">
                {en ? (
                  <>
                    Only available when running the project locally. Here, use{" "}
                    <strong>Choose file…</strong> — the ROM is kept in this browser and
                    shows up again under “In your library” on later visits.
                  </>
                ) : (
                  <>
                    Disponível só rodando o projeto localmente. Aqui, use{" "}
                    <strong>Escolher arquivo…</strong> — a ROM fica guardada neste
                    navegador e reaparece em “Na sua biblioteca” nas próximas
                    visitas.
                  </>
                )}
              </p>
            ) : emu.localRoms.length > 0 ? (
              <ul className="play-rom-list">
                {emu.localRoms.slice().sort(compareRomsChronologically).map((rom) => (
                  <li key={rom.fileName}>
                    <button
                      type="button"
                      className={rom.fileName === currentRom ? "is-current" : ""}
                      onClick={() => void emu.playLocal(rom.fileName)}
                    >
                      <span className="play-rom-name">{rom.fileName}</span>
                      <span className="play-rom-meta">
                        {romRelease(rom.fileName)?.date.slice(0, 4) ?? tx("Data não cadastrada", "Release date unknown")} · {" "}
                        {consoleOf(rom.fileName)} · {formatBytes(rom.size)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="play-empty-folder">
                {en ? (
                  <>
                    Empty. Drop your <code>.gb</code>, <code>.gbc</code> or{" "}
                    <code>.gba</code> files into <code>roms/</code>{" "}
                    {location.protocol === "pokemu:" ? "(Pokemu menu → Open ROMs folder) — in" : "at the project root — in"}
                    subfolders too — and they show up here, one click away.
                  </>
                ) : (
                  <>
                    Vazia. Largue seus <code>.gb</code>, <code>.gbc</code> ou{" "}
                    <code>.gba</code> em <code>roms/</code>{" "}
                    {location.protocol === "pokemu:" ? "(menu Pokemu → Abrir pasta de ROMs) — em" : "na raiz do projeto — em"}
                    subpastas também — e eles aparecem aqui, prontos para um clique.
                  </>
                )}
              </p>
            )}
            <p className="play-panel-hint">
              {tx("Ordem de lançamento original dos títulos; jogos sem data cadastrada aparecem ao final.", "Titles sorted by original release; games without a known release date appear last.")}{" "}
              {location.protocol === "pokemu:" ? tx("Use o menu Pokemu para abrir suas pastas de ROMs e saves.", "Use the Pokemu menu to open your ROM and save folders.") : tx(
                "Fora do git e fora do build: os arquivos ficam só na sua máquina.",
                "Outside git and outside the build: the files stay on your machine only."
              )}
            </p>
          </section>

          {emu.roms.length > 0 && (
            <section className="play-panel">
              <h2>{tx("Na sua biblioteca", "In your library")}</h2>
              <ul className="play-rom-list">
                {emu.roms.slice().sort(compareRomsChronologically).map((rom) => (
                  <li key={rom.fileName} className="play-rom-row">
                    <button
                      type="button"
                      className={
                        rom.fileName === currentRom
                          ? "is-current"
                          : rom.fileName === romPedida
                            ? "is-pedida"
                            : ""
                      }
                      onClick={() => emu.playStored(rom.fileName)}
                    >
                      <span className="play-rom-name">{rom.fileName}</span>
                      <span className="play-rom-meta">
                        {romRelease(rom.fileName)?.date.slice(0, 4) ?? tx("Data não cadastrada", "Release date unknown")} · {" "}
                        {consoleOf(rom.fileName)}
                        {rom.base && ` · base: ${rom.base}`}
                        {rom.size !== undefined && ` · ${formatBytes(rom.size)}`}
                      </span>
                    </button>
                    {/* Dois passos em vez de um confirm() do navegador: são
                        dezenas de MB que não voltam, e um diálogo modal para
                        isso é pesado demais. */}
                    {removing === rom.fileName ? (
                      <span className="play-rom-confirm">
                        <button
                          type="button"
                          className="play-rom-confirm-yes"
                          onClick={() => {
                            void emu.deleteRom(rom.fileName);
                            setRemoving(null);
                          }}
                        >
                          {tx("remover", "remove")}
                        </button>
                        <button type="button" onClick={() => setRemoving(null)}>
                          {tx("cancelar", "cancel")}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="play-rom-remove"
                        title={tx(`Remover ${rom.fileName} da biblioteca`, `Remove ${rom.fileName} from the library`)}
                        aria-label={tx(`Remover ${rom.fileName} da biblioteca`, `Remove ${rom.fileName} from the library`)}
                        // O jogo em execução não pode sair da biblioteca: a
                        // confirmação só devolvia "feche antes".
                        disabled={rom.fileName === currentRom}
                        onClick={() => setRemoving(rom.fileName)}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="play-panel-hint">
                {en ? (
                  <>
                    Removing frees space in the browser and <strong>keeps the save</strong>: if
                    the same ROM comes back, the progress comes back with it.
                  </>
                ) : (
                  <>
                    Remover libera espaço no navegador e <strong>mantém o save</strong>
                    : se a mesma ROM voltar, o progresso volta com ela.
                  </>
                )}
              </p>
            </section>
          )}

          </details>
  );
}
