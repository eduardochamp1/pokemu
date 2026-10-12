import { useMemo, useState } from "react";
import type { TrainerEntry } from "../lib/trainerLog";
import {
  MOMENT_HEIGHT,
  MOMENT_WIDTH,
  albumMoments,
  drawMoment,
  momentFileName,
  momentLabel,
  type Moment,
} from "../lib/journeyAlbum";
import type { CardTheme } from "../lib/trainerCardImage";
import { pixelSpriteUrl } from "../lib/sprites";
import { adventureLabel } from "../lib/activeAdventure";
import { localeOf, tr, useLang } from "../i18n/lang";
import "../styles/album.css";

function carregar(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function temaAtual(): CardTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (nome: string, padrao: string) => css.getPropertyValue(nome).trim() || padrao;
  return {
    paper: v("--paper", "#f4efe1"),
    ink: v("--paper-ink", "#2b2620"),
    accent: v("--accent", "#7a9a01"),
    font: v("--font-display", "sans-serif"),
  };
}

/**
 * O álbum da jornada: insígnias, evoluções e conquistas como cartões, cada um
 * com um PNG para baixar.
 */
export default function JourneyAlbum({ entry, nameOf }: { entry: TrainerEntry; nameOf: (national: number) => string }) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const [erro, setErro] = useState<string | null>(null);
  const momentos = useMemo(() => albumMoments(entry, nameOf, lang), [entry, nameOf, lang]);

  const data = (at: number) =>
    new Date(at).toLocaleDateString(localeOf(lang), { day: "2-digit", month: "long", year: "numeric" });
  const registrado = (at: number) => `${t("Registrado em", "Recorded on")} ${data(at)}`;

  const baixar = async (m: Moment) => {
    setErro(null);
    try {
      await document.fonts?.ready;
      const sprite = m.national ? await carregar(pixelSpriteUrl(m.national)) : null;
      const canvas = document.createElement("canvas");
      canvas.width = MOMENT_WIDTH;
      canvas.height = MOMENT_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("sem canvas");
      drawMoment(ctx, m, `Pokemu · ${adventureLabel(entry.rom)} · ${entry.playerName}`, registrado(m.at), sprite, temaAtual(), lang);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("sem imagem");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = momentFileName(entry.rom, m);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErro(t("Não foi possível gerar a imagem deste cartão.", "Couldn't generate this card's image."));
    }
  };

  return (
    <section className="ui-panel journey-album" aria-label={t("Álbum da jornada", "Journey album")}>
      <h2>
        {t("Álbum da jornada", "Journey album")} <span>{momentos.length}</span>
      </h2>
      {momentos.length === 0 ? (
        <p className="page-scope">
          {t(
            "Insígnias, evoluções e conquistas que o site registrar entre um save e outro viram cartões aqui.",
            "Badges, evolutions and achievements the site records between saves become cards here."
          )}
        </p>
      ) : (
        <ul className="album-grid">
          {momentos.map((m) => (
            <li key={m.id} className={`album-card album-${m.kind}`}>
              <small>{momentLabel(m.kind, lang)}</small>
              <strong>{m.title}</strong>
              <span>{m.subtitle}</span>
              {m.national && <img src={pixelSpriteUrl(m.national)} alt="" width={64} height={64} loading="lazy" />}
              <time dateTime={new Date(m.at).toISOString()}>{registrado(m.at)}</time>
              <button type="button" onClick={() => void baixar(m)}>
                {t("Baixar PNG", "Download PNG")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {erro && <p role="alert">{erro}</p>}
    </section>
  );
}
