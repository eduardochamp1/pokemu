export interface PokemonListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: { name: string; url: string }[];
}

export interface PokemonType {
  slot: number;
  type: { name: string; url: string };
}

export interface PokemonStat {
  base_stat: number;
  effort: number;
  stat: { name: string; url: string };
}

export interface PokemonAbility {
  is_hidden: boolean;
  slot: number;
  ability: { name: string; url: string };
}

/**
 * Como os slots eram **antes** de `generation`. `ability: null` = o slot não
 * existia (ex.: habilidade oculta antes da Gen V).
 */
export interface PastAbilities {
  generation: { name: string; url: string };
  abilities: {
    is_hidden: boolean;
    slot: number;
    ability: { name: string; url: string } | null;
  }[];
}

export interface ShowdownSprites {
  front_default: string | null;
  front_shiny: string | null;
  back_default: string | null;
  back_shiny: string | null;
}

export interface OfficialArtwork {
  front_default: string | null;
  front_shiny: string | null;
}

export interface PokemonSprites {
  front_default: string | null;
  front_shiny: string | null;
  back_default: string | null;
  back_shiny: string | null;
  other?: {
    ["official-artwork"]?: OfficialArtwork;
    dream_world?: { front_default: string | null };
    home?: { front_default: string | null; front_shiny: string | null };
    showdown?: ShowdownSprites;
  };
}

export interface EvolutionDetail {
  trigger: { name: string; url: string };
  min_level: number | null;
  item: { name: string; url: string } | null;
  held_item: { name: string; url: string } | null;
  known_move: { name: string; url: string } | null;
  known_move_type?: { name: string; url: string } | null;
  location: { name: string; url: string } | null;
  min_happiness: number | null;
  min_affection: number | null;
  min_beauty: number | null;
  needs_overworld_rain: boolean;
  time_of_day: string;
  turn_upside_down: boolean;
  gender: number | null;
  trade_species: { name: string; url: string } | null;
}

export interface EvolutionNode {
  species: { name: string; url: string };
  evolves_to: EvolutionNode[];
  evolution_details: EvolutionDetail[];
}

/** Como e em que jogo o pokemon aprende um golpe. */
export interface PokemonMoveVersion {
  /** 0 quando o metodo nao e por nivel. */
  level_learned_at: number;
  version_group: { name: string; url: string };
  move_learn_method: { name: string; url: string };
}

export interface PokemonMove {
  move: { name: string; url: string };
  /** Uma entrada por jogo em que o golpe e aprendido. */
  version_group_details: PokemonMoveVersion[];
}

export interface Pokemon {
  id: number;
  name: string;
  sprites: PokemonSprites;
  types: PokemonType[];
  /** Tipos **até** aquela geração, inclusive (Clefairy era Normal até a Gen 5). */
  past_types?: { generation: { name: string; url: string }; types: PokemonType[] }[];
  stats: PokemonStat[];
  abilities: PokemonAbility[];
  /** Vem na mesma resposta; usado para saber a habilidade de Gen 3. */
  past_abilities?: PastAbilities[];
  height: number;
  weight: number;
  species: { name: string; url: string };
  base_experience: number | null;
  cries?: { latest: string | null; legacy: string | null };
  /**
   * Ja vinha na resposta que buscamos e era ignorado — sao 109 golpes so no
   * Pikachu, sem custo de request nenhum.
   */
  moves: PokemonMove[];
}

/** Detalhe de um golpe, buscado sob demanda em /move/{nome}. */
export interface MoveDetail {
  id: number;
  name: string;
  accuracy: number | null;
  power: number | null;
  pp: number | null;
  priority: number;
  type: { name: string; url: string };
  damage_class: { name: string; url: string };
  /** Valores que valiam **antes** de cada grupo de versões. */
  past_values?: {
    power: number | null;
    type: { name: string; url: string } | null;
    version_group: { name: string; url: string };
  }[];
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
  }[];
  names: { name: string; language: { name: string } }[];
}
