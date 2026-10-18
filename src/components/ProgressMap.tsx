import { useState } from "react";
import { HOENN_TOWNS } from "../data/hoenn";
import {
  HOENN_LAYOUT,
  HOENN_LINKS,
  MAX_MARKS,
  setMapMarks,
  sortMarks,
  useMapMarks,
} from "../lib/mapMarks";
import { tr, useLang } from "../i18n/lang";
import { StaleWriteError } from "../lib/recordStore";
import "../styles/progressMap.css";

interface Props {
  rom: string;
  /** Índices das cidades de Hoenn já visitadas, quando o save as informa (Emerald). */
  visitedTowns?: number[];
}

const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Mapa de progresso: em Emerald, o esquema de Hoenn com as cidades que o save
 * diz que já foram visitadas; em qualquer jogo, os lugares que a pessoa marca.
 */
export default function ProgressMap({ rom, visitedTowns }: Props) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const marks = useMapMarks(rom);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const salvar = (next: typeof marks) => {
    try {
      setMapMarks(rom, next);
      setErro(null);
    } catch (error) {
      setErro(
        error instanceof StaleWriteError
          ? t("Estas marcações mudaram em outra aba. A lista foi atualizada; confira e tente de novo.", "These marks changed in another tab. The list was refreshed; check it and try again.")
          : t("Não foi possível guardar a marcação.", "Couldn't save the mark.")
      );
    }
  };

  const visitadas = new Set(visitedTowns ?? []);

  return (
    <section className="ui-panel progress-map" aria-label={t("Mapa de progresso", "Progress map")}>
      <h2>{t("Mapa de progresso", "Progress map")}</h2>

      {visitedTowns ? (
        <>
          <p className="trainer-sub">
            {visitadas.size} / {HOENN_TOWNS.length} {t("cidades visitadas no último save lido.", "towns visited in the last save read.")}
          </p>
          <svg
            className="progress-map-svg"
            viewBox="-4 -2 108 66"
            role="img"
            aria-label={t(
              `Esquema de Hoenn: ${visitadas.size} de ${HOENN_TOWNS.length} cidades visitadas`,
              `Hoenn sketch: ${visitadas.size} of ${HOENN_TOWNS.length} towns visited`
            )}
          >
            {HOENN_LINKS.map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={HOENN_LAYOUT[a].x}
                y1={HOENN_LAYOUT[a].y}
                x2={HOENN_LAYOUT[b].x}
                y2={HOENN_LAYOUT[b].y}
                className={visitadas.has(a) && visitadas.has(b) ? "is-visited" : undefined}
              />
            ))}
            {HOENN_LAYOUT.map((p, i) => (
              <g key={HOENN_TOWNS[i]} className={visitadas.has(i) ? "is-visited" : undefined}>
                <circle cx={p.x} cy={p.y} r={1.8} />
                <text x={p.x} y={p.y - 2.8} textAnchor="middle">
                  {HOENN_TOWNS[i].replace(/ (Town|City)$/, "")}
                </text>
              </g>
            ))}
          </svg>
          {/* O desenho não é lido por leitor de tela cidade a cidade: a lista é. */}
          <ul className="visually-hidden">
            {HOENN_TOWNS.map((nome, i) => (
              <li key={nome}>
                {nome}: {visitadas.has(i) ? t("visitada", "visited") : t("não visitada", "not visited")}
              </li>
            ))}
          </ul>
          <p className="trainer-sub">
            {t(
              "Esquema fora de escala. Mostra onde você já esteve, não onde está agora: o save não diz isso ao site.",
              "Sketch, not to scale. It shows where you've been, not where you are now: the save doesn't tell the site that."
            )}
          </p>
        </>
      ) : (
        <p className="page-scope">
          {t(
            "As cidades visitadas só são lidas do save de Emerald. Para este jogo, o mapa é o que você marcar abaixo.",
            "Visited towns are only read from Emerald saves. For this game, the map is whatever you mark below."
          )}
        </p>
      )}

      <h3>
        {t("Seus lugares marcados", "Your marked places")} · {marks.length}
      </h3>
      <form
        className="ui-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!place.trim() || marks.length >= MAX_MARKS) return;
          salvar([...marks, { id: novoId(), place: place.trim().slice(0, 80), note: note.trim().slice(0, 300), at: Date.now() }]);
          setPlace("");
          setNote("");
        }}
      >
        <label>
          {t("Lugar", "Place")}
          <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder={t("Rota 119", "Route 119")} />
        </label>
        <label>
          {t("Por que voltar", "Why come back")}
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={t("Precisa de Surf", "Needs Surf")} />
        </label>
        <button type="submit" disabled={!place.trim()}>{t("Marcar", "Mark")}</button>
      </form>
      {marks.length > 0 && (
        <ul className="ui-list">
          {sortMarks(marks).map((m) => (
            <li key={m.id}>
              <label className={m.done ? "is-done" : undefined}>
                <input
                  type="checkbox"
                  checked={m.done === true}
                  onChange={(e) => salvar(marks.map((x) => (x.id === m.id ? { ...x, done: e.target.checked } : x)))}
                />{" "}
                <strong>{m.place}</strong>
                {m.note ? ` · ${m.note}` : ""}
              </label>
              <button type="button" aria-label={t(`Remover a marcação de ${m.place}`, `Remove the ${m.place} mark`)} onClick={() => salvar(marks.filter((x) => x.id !== m.id))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p role="alert">{erro}</p>}
    </section>
  );
}
