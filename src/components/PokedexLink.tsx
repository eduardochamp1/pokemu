import type { ReactNode } from "react";
import { pokedexUrl } from "../lib/pokedexSite";

interface Props {
  /** Caminho dentro da Pokédex: `/pokemon/pikachu`, `/mapa?region=hoenn`. */
  to: string;
  className?: string;
  title?: string;
  children: ReactNode;
}

/**
 * Link para uma página da Pokédex, que é outro site.
 *
 * Abre em outra aba de propósito: sair desta pausa o jogo. Sem o endereço
 * configurado o conteúdo aparece igual, só sem link.
 */
const PokedexLink = ({ to, className, title, children }: Props) => {
  const href = pokedexUrl(to);
  return href ? (
    <a href={href} className={className} title={title} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ) : (
    <span className={className} title={title}>
      {children}
    </span>
  );
};

export default PokedexLink;
