import type { TrainerEntry } from "./trainerLog";
import { achievementById } from "./achievements";
import { badgesOf } from "./gen3Game";
import type { CardTheme } from "./trainerCardImage";
import type { Lang } from "../i18n/lang";

/**
 * Álbum da jornada: os marcos de uma aventura como cartões que dá para baixar.
 *
 * Um marco é algo que o leitor de save registrou e que vale guardar: uma
 * insígnia, uma evolução, uma conquista. Capturas e subidas de nível ficam na
 * linha do tempo — são muitas, e um álbum com trezentos cartões não é álbum.
 *
 * A data de cada cartão é a do save em que o marco apareceu, e o cartão diz
 * "registrado em", não "aconteceu em".
 */

export interface Moment {
  id: string;
  kind: "badge" | "evolved" | "achievement";
  title: string;
  subtitle: string;
  at: number;
  /** Espécie para ilustrar o cartão, quando há uma. */
  national?: number;
}

export function albumMoments(
  entry: TrainerEntry,
  nameOf: (national: number) => string,
  lang: Lang
): Moment[] {
  const en = lang === "en";
  const insignias = badgesOf(entry.game ?? "emerald");
  const out: Moment[] = [];
  entry.events.forEach((e, i) => {
    if (e.kind === "badge") {
      const b = insignias[e.index];
      out.push({
        id: `badge:${e.index}:${e.at}`,
        kind: "badge",
        title: b?.name ?? (en ? `Badge ${e.index + 1}` : `Insígnia ${e.index + 1}`),
        subtitle: b ? `${b.leader} · ${b.city}` : "",
        at: e.at,
      });
    } else if (e.kind === "evolved") {
      out.push({
        id: `evolved:${i}:${e.at}`,
        kind: "evolved",
        title: en ? `${e.nickname} evolved` : `${e.nickname} evoluiu`,
        subtitle: `${nameOf(e.from)} → ${nameOf(e.to)}`,
        at: e.at,
        national: e.to,
      });
    } else if (e.kind === "achievement") {
      const a = achievementById(e.id);
      if (!a) return;
      out.push({
        id: `achievement:${e.id}:${e.at}`,
        kind: "achievement",
        title: a.title[lang],
        subtitle: a.description[lang],
        at: e.at,
      });
    }
  });
  return out.sort((a, b) => b.at - a.at);
}

export const MOMENT_WIDTH = 640;
export const MOMENT_HEIGHT = 360;

const ROTULO: Record<Moment["kind"], [pt: string, en: string]> = {
  badge: ["INSÍGNIA", "BADGE"],
  evolved: ["EVOLUÇÃO", "EVOLUTION"],
  achievement: ["CONQUISTA", "ACHIEVEMENT"],
};

export function momentLabel(kind: Moment["kind"], lang: Lang): string {
  return ROTULO[kind][lang === "en" ? 1 : 0];
}

/** Quebra o texto em linhas que cabem na largura, no máximo `maxLines`. */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of text.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (measure(tentativa) <= maxWidth || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length <= maxLines) return linhas;
  const cortadas = linhas.slice(0, maxLines);
  cortadas[maxLines - 1] = cortadas[maxLines - 1].replace(/.{0,3}$/, "…");
  return cortadas;
}

/** Desenha um marco no canvas, com as cores do tema do site. */
export function drawMoment(
  ctx: CanvasRenderingContext2D,
  m: Moment,
  footer: string,
  dateText: string,
  sprite: HTMLImageElement | null,
  theme: CardTheme,
  lang: Lang
): void {
  const W = MOMENT_WIDTH;
  const H = MOMENT_HEIGHT;
  const tinta = (alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.ink;
  };
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);

  const larguraTexto = sprite ? W - 64 - 200 : W - 64;

  tinta(0.75);
  ctx.font = `700 14px ${theme.font}`;
  ctx.fillText(momentLabel(m.kind, lang), 32, 46);

  tinta(1);
  ctx.font = `700 36px ${theme.font}`;
  const titulo = wrapText((s) => ctx.measureText(s).width, m.title, larguraTexto, 2);
  titulo.forEach((linha, i) => ctx.fillText(linha, 32, 104 + i * 42));

  tinta(0.7);
  ctx.font = `400 19px ${theme.font}`;
  const base = 104 + titulo.length * 42;
  wrapText((s) => ctx.measureText(s).width, m.subtitle, larguraTexto, 3).forEach((linha, i) =>
    ctx.fillText(linha, 32, base + 4 + i * 26)
  );

  if (sprite) {
    ctx.globalAlpha = 1;
    // Sprite pixelado: ampliar sem suavizar.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, W - 32 - 192, 84, 192, 192);
  }

  tinta(0.6);
  ctx.font = `400 14px ${theme.font}`;
  ctx.fillText(dateText, 32, H - 54);
  tinta(0.85);
  ctx.font = `700 14px ${theme.font}`;
  ctx.fillText(footer, 32, H - 30);
  ctx.globalAlpha = 1;
}

export function momentFileName(rom: string, m: Moment): string {
  const base = rom.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  const slug = m.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${base}-${m.kind}-${slug || "marco"}.png`;
}
