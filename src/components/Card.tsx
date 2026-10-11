import { useRef } from "react";
import { useTiltEffect } from "../hooks/useTiltEffect";
import { displayName } from "../api";
import { LEGENDARY, MYTHICAL } from "../data/rarity";
import { tType } from "../data/i18n";
import type { Pokemon } from "../types/pokemon";
import { useT } from "../i18n/lang";
import PokedexLink from "./PokedexLink";

interface Props {
  pokemon: Pokemon;
  variant?: "grid" | "mini";
  /** Caminho da ficha na Pokédex, que é outro site (ver PokedexLink). */
  linkTo?: string;
  /** Posicao na grade: atrasa a entrada de cada carta em cascata. */
  index?: number;
}

const STAT_ORDER = ["hp", "attack", "defense"] as const;
const STAT_LABEL: Record<(typeof STAT_ORDER)[number], string> = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
};

const Card = ({
  pokemon,
  variant = "grid",
  linkTo,
  index = 0,
}: Props) => {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  useTiltEffect(cardRef, { maxDeg: variant === "mini" ? 4 : 8 });

  const isLegendary = LEGENDARY.includes(pokemon.name);
  const isMythical = MYTHICAL.includes(pokemon.name);
  const primaryType = pokemon.types[0]?.type.name ?? "normal";
  const artwork =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.front_default ??
    "";

  const stats = STAT_ORDER.map((slug) => {
    const s = pokemon.stats.find((x) => x.stat.name === slug);
    return { slug, value: s?.base_stat ?? 0 };
  });

  const inner = (
    <>
      <div className="card-header">
        <div className="card-name">{displayName(pokemon.name)}</div>
        <div className="card-header-right">
          <div className="card-types">
            {pokemon.types.map((t) => (
              <span
                key={t.type.name}
                className="card-type-dot"
                data-type={t.type.name}
                title={tType(t.type.name)}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="card-artwork">
        {artwork ? (
          <img
            src={artwork}
            crossOrigin="anonymous"
            alt={pokemon.name}
            loading="lazy"
            decoding="async"
            width={220}
            height={220}
          />
        ) : (
          <span>?</span>
        )}
      </div>
      <div className="card-footer">
        <div className="card-meta-row">
          <span className="card-id">{String(pokemon.id).padStart(4, "0")}</span>
          <span className="card-hp">
            {t("PS", "HP")} <strong>{stats[0].value}</strong>
          </span>
        </div>
        {variant === "grid" && (
          <ul className="card-stats">
            {stats.slice(1).map((s) => (
              <li key={s.slug}>
                <span className="card-stat-label">{STAT_LABEL[s.slug]}</span>
                <span className="card-stat-bar">
                  <span
                    className="card-stat-fill"
                    style={{ width: `${Math.min(100, (s.value / 200) * 100)}%` }}
                  />
                </span>
                <span className="card-stat-value">{s.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Simbolo de raridade no canto, como na carta: le-se sem depender de cor. */}
      {isLegendary && !isMythical && (
        <span className="card-badge" title={t("Lendário", "Legendary")} aria-hidden="true">
          ★
        </span>
      )}
      {isMythical && (
        <span
          className="card-badge card-badge-mythical"
          title={t("Mítico", "Mythical")}
          aria-hidden="true"
        >
          ✦
        </span>
      )}
    </>
  );

  const className =
    "card" +
    ` card-${variant}` +
    (isLegendary ? " is-legendary" : "") +
    (isMythical ? " is-mythical" : "");

  return (
    <div
      ref={cardRef}
      className={className}
      data-primary-type={primaryType}
      style={{
        ["--type-color" as string]: `var(--t-${primaryType})`,
        ["--i" as string]: String(index),
      }}
    >
      <div className="card-foil" aria-hidden="true" />
      <div className="card-spectral" aria-hidden="true" />
      <div className="card-glitter" aria-hidden="true" />
      {linkTo ? (
        <PokedexLink to={linkTo} className="card-link">
          {inner}
        </PokedexLink>
      ) : (
        inner
      )}
    </div>
  );
};

export default Card;
