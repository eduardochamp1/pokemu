/**
 * Cenário da calculadora de dano vindo da URL:
 * `/dano?atk=<posição no time>&def=<espécie>&nivel=<n>`.
 *
 * É o que liga Ginásios à calculadora: o guia diz quem bate melhor em cada
 * pokémon do líder pelo tipo, e o link abre a conta já montada.
 */

export interface DamageScenario {
  /** Posição do atacante no time do save. */
  atk?: number;
  def?: { slug: string; level: number };
}

/**
 * Lê o cenário descartando o que não faz sentido: posição fora do time, nível
 * fora de 1–100, espécie com caractere que não é de slug. Um link quebrado
 * abre a calculadora no padrão em vez de num estado inválido.
 */
export function parseScenario(params: URLSearchParams, teamSize: number): DamageScenario {
  const out: DamageScenario = {};
  const atk = params.get("atk");
  if (atk !== null && /^\d+$/.test(atk) && Number(atk) < teamSize) out.atk = Number(atk);
  const def = params.get("def");
  const nivel = Number(params.get("nivel"));
  if (def && /^[a-z0-9-]+$/.test(def)) {
    out.def = { slug: def, level: Number.isInteger(nivel) && nivel >= 1 && nivel <= 100 ? nivel : 50 };
  }
  return out;
}

export function scenarioUrl(attackerIndex: number, defenderSlug: string, defenderLevel: number): string {
  return `/dano?atk=${attackerIndex}&def=${encodeURIComponent(defenderSlug)}&nivel=${defenderLevel}`;
}
