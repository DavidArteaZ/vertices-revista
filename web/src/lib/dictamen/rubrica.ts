/**
 * Tipos de la rúbrica, desacoplados de la base de datos a propósito: el motor
 * de decisión se prueba con objetos literales, sin Postgres de por medio.
 */

export type Puerta = {
  id: number;
  etiqueta: string;
  esEliminatoria: boolean;
};

export type Dimension = {
  id: number;
  etiqueta: string;
  esCritica: boolean;
  peso: number;
  permiteNa: boolean;
};

export type Decision = {
  id: number;
  etiqueta: string;
  esAceptante: boolean;
  esFalla: boolean;
};

export type Banda = {
  /** El máximo al que aplica este juego de umbrales. */
  variante: number;
  /** Umbral inferior inclusivo. */
  minPuntaje: number;
  decisionId: number;
};

export type Rubrica = {
  id: number;
  puertas: Puerta[];
  dimensiones: Dimension[];
  decisiones: Decision[];
  bandas: Banda[];
  etiquetaFallaPuerta: string;
  etiquetaFallaCritico: string;
  etiquetaPendiente: string;
};

/**
 * Las respuestas de una tarjeta, con la semántica de tres estados del libro:
 *
 *   | estado          | puerta                     | dimensión            |
 *   |-----------------|----------------------------|----------------------|
 *   | clave ausente   | no contestada → reprueba   | sin calificar        |
 *   | null            | no contestada → reprueba   | N/A (sólo permiteNa) |
 *   | valor           | tal cual                   | tal cual             |
 */
export type Respuestas = {
  puertas: ReadonlyMap<number, boolean | null>;
  puntajes: ReadonlyMap<number, number | null>;
};

export type MotivoDecision = "pendiente" | "falla_puerta" | "falla_critico" | "banda";

export type Resultado = {
  puntaje: number;
  maximo: number;
  puertasOk: boolean;
  criticosOk: boolean;
  decision: Decision;
  motivo: MotivoDecision;
};
