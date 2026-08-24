import type {
  Decision,
  Dimension,
  Respuestas,
  Resultado,
  Rubrica,
} from "./rubrica";

/**
 * El motor de decisión (spec §6). Reproduce la cascada del libro de Excel:
 *
 *   1. ninguna dimensión calificada    → etiqueta_pendiente
 *   2. alguna puerta ★ que no sea "Sí" → etiqueta_falla_puerta
 *   3. alguna crítica ★ < 2, o crítica ★ sin calificar → etiqueta_falla_critico
 *   4. si no                            → banda por puntaje
 *
 *   puntaje = Σ (valor × peso) sobre las dimensiones calificadas
 *   máximo  = Σ (3 × peso), excluyendo las calificadas N/A
 *
 * Las reglas 2 y 3 son más estrictas de lo que parecen, y a propósito. El
 * libro escribe U8 = IF(AND(F8="Sí"),"Sí","No"), de modo que una puerta EN
 * BLANCO reprueba. Y V8 = IF(OR($A8="",COUNT(J8:M8)=0),"",IF(AND(J8>=2),...)),
 * donde una crítica en blanco vale 0 en la comparación y por tanto reprueba en
 * cuanto se califique cualquier otra dimensión. Tratar una crítica sin
 * calificar como "sáltala" daría un veredicto más favorable que el que da el
 * instrumento real.
 */
export function decidir(rubrica: Rubrica, respuestas: Respuestas): Resultado {
  const porEtiqueta = (etiqueta: string): Decision => {
    const d = rubrica.decisiones.find((x) => x.etiqueta === etiqueta);
    if (!d) {
      throw new Error(
        `la rúbrica ${rubrica.id} no tiene una decisión con la etiqueta "${etiqueta}"`,
      );
    }
    return d;
  };

  /** Calificada = presente y no N/A. Una dimensión N/A no cuenta como calificada. */
  const valorDe = (d: Dimension): number | null | undefined => respuestas.puntajes.get(d.id);
  const estaCalificada = (d: Dimension) => {
    const v = valorDe(d);
    return v !== undefined && v !== null;
  };
  const esNa = (d: Dimension) => respuestas.puntajes.get(d.id) === null;

  // Mismo invariante que el trigger de la base: null significa N/A y sólo lo
  // admite una dimensión en todo el libro. En cualquier otra sería "sin
  // calificar" disfrazado de respuesta, y la cascada tiene que poder
  // distinguir esos dos estados.
  for (const d of rubrica.dimensiones) {
    if (esNa(d) && !d.permiteNa) {
      throw new Error(`la dimensión "${d.etiqueta}" no admite N/A`);
    }
  }

  const calificadas = rubrica.dimensiones.filter(estaCalificada);

  const puntaje = calificadas.reduce((s, d) => s + (valorDe(d) as number) * d.peso, 0);

  // El máximo excluye lo calificado N/A. Es lo que hace T8 en Datanomics:
  // IF(O8="N/A",12,15).
  const maximo = rubrica.dimensiones
    .filter((d) => !esNa(d))
    .reduce((s, d) => s + 3 * d.peso, 0);

  // Una puerta ★ sólo pasa si la respuesta es exactamente true. Ausente o
  // null reprueban.
  const puertasOk = rubrica.puertas
    .filter((p) => p.esEliminatoria)
    .every((p) => respuestas.puertas.get(p.id) === true);

  // Una crítica ★ sin calificar reprueba, igual que si valiera 0.
  const criticosOk = rubrica.dimensiones
    .filter((d) => d.esCritica)
    .every((d) => {
      const v = valorDe(d);
      return typeof v === "number" && v >= 2;
    });

  const base = { puntaje, maximo, puertasOk, criticosOk };

  if (calificadas.length === 0) {
    return { ...base, decision: porEtiqueta(rubrica.etiquetaPendiente), motivo: "pendiente" };
  }
  if (!puertasOk) {
    return { ...base, decision: porEtiqueta(rubrica.etiquetaFallaPuerta), motivo: "falla_puerta" };
  }
  if (!criticosOk) {
    return { ...base, decision: porEtiqueta(rubrica.etiquetaFallaCritico), motivo: "falla_critico" };
  }

  // La variante de banda es el máximo vigente. Sólo Datanomics tiene dos
  // juegos, /15 y /12, y cuál aplica depende de si el how-to se calificó N/A.
  const candidatas = rubrica.bandas
    .filter((b) => b.variante === maximo)
    .sort((a, b) => b.minPuntaje - a.minPuntaje);

  if (candidatas.length === 0) {
    throw new Error(
      `la rúbrica ${rubrica.id} no tiene bandas para el máximo ${maximo}; ` +
        `las que tiene son ${[...new Set(rubrica.bandas.map((b) => b.variante))].join(", ")}`,
    );
  }

  const banda = candidatas.find((b) => puntaje >= b.minPuntaje);
  if (!banda) {
    throw new Error(
      `la rúbrica ${rubrica.id} no cubre el puntaje ${puntaje} en la variante ${maximo}: ` +
        "falta una banda con min_puntaje 0",
    );
  }

  const decision = rubrica.decisiones.find((d) => d.id === banda.decisionId);
  if (!decision) {
    throw new Error(`la banda apunta a la decisión ${banda.decisionId}, que no está en la rúbrica`);
  }

  return { ...base, decision, motivo: "banda" };
}
