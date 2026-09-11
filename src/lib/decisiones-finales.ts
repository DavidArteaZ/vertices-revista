export const DECISIONES_FINALES = [
  "Aceptada",
  "Aceptada con revisiones menores",
  "Revisiones mayores",
  "Rechazado",
] as const;

export type DecisionFinal = (typeof DECISIONES_FINALES)[number];

export function esDecisionFinal(valor: string): valor is DecisionFinal {
  return (DECISIONES_FINALES as readonly string[]).includes(valor);
}

export function ordenDecisionFinal(decision: DecisionFinal): number {
  return DECISIONES_FINALES.indexOf(decision) + 1;
}

export function requiereComentarios(decision: DecisionFinal): boolean {
  return decision !== "Aceptada";
}

const SUFIJO_ORDINAL_ES: Record<number, string> = {
  1: "era",
  2: "da",
  3: "era",
  4: "ta",
  5: "ta",
  6: "ta",
  7: "ma",
  8: "va",
  9: "na",
  10: "ma",
};

/** Ordinal femenino, porque modifica a «edición»: 1era, 2da, 3era, etc. */
export function ordinalEdicionEs(numero: number): string {
  return SUFIJO_ORDINAL_ES[numero] ? `${numero}${SUFIJO_ORDINAL_ES[numero]}` : `${numero}.ª`;
}

/** Ordinal inglés con las excepciones 11th, 12th y 13th. */
export function ordinalEn(numero: number): string {
  const ultimosDos = numero % 100;
  if (ultimosDos >= 11 && ultimosDos <= 13) return `${numero}th`;
  switch (numero % 10) {
    case 1: return `${numero}st`;
    case 2: return `${numero}nd`;
    case 3: return `${numero}rd`;
    default: return `${numero}th`;
  }
}
