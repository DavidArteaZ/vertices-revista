/**
 * El estado de una invitación al comité, en dos funciones puras.
 *
 * Están juntas y sin `server-only` porque son la misma pregunta vista desde los
 * dos extremos: el webhook de Resend escribe con `estadoDeEvento` y la pantalla
 * del comité lee con `estadoDePersona`. Separarlas en dos módulos sólo repartía
 * la tabla de estados en dos sitios donde podía divergir.
 */

/** Lo que Resend dice que le pasó al correo, traducido a lo que se guarda. */
const EVENTOS: Record<string, string> = {
  "email.delivered": "entregado",
  "email.bounced": "rebotado",
  "email.complained": "quejado",
  "email.delivery_delayed": "retrasado",
};

export function estadoDeEvento(evento: string): string | null {
  return EVENTOS[evento] ?? null;
}

export type FilaEstado = {
  activo: boolean;
  invitada_en: string | null;
  clave_fijada_en: string | null;
  invitacion_estado: string | null;
};

export type Estado = { etiqueta: string; clase: "etiqueta--lista" | "etiqueta--alerta" };

const DIA = 24 * 60 * 60 * 1000;

/**
 * El orden importa y es lo que estas ramas fijan:
 *
 *   · dar de baja gana sobre todo: quien está fuera está fuera aunque su cuenta
 *     funcione perfectamente.
 *   · haber fijado la contraseña gana sobre un rebote, porque el rebote puede
 *     ser de un reenvío posterior y la cuenta ya entra.
 *   · un rebote sin contraseña fijada es la señal que no existía antes: nadie
 *     se enteraba de una invitación mandada a una dirección mal escrita.
 */
export function estadoDePersona(fila: FilaEstado, ahora = new Date()): Estado {
  if (!fila.activo) return { etiqueta: "De baja", clase: "etiqueta--alerta" };
  if (fila.clave_fijada_en) return { etiqueta: "Activa", clase: "etiqueta--lista" };

  if (fila.invitacion_estado === "rebotado" || fila.invitacion_estado === "quejado") {
    return { etiqueta: "Correo rebotado", clase: "etiqueta--alerta" };
  }

  if (fila.invitada_en) {
    const dias = Math.floor((ahora.getTime() - new Date(fila.invitada_en).getTime()) / DIA);
    const cuando = dias < 1 ? "hoy" : `hace ${dias} d`;
    return { etiqueta: `Invitada · pendiente (${cuando})`, clase: "etiqueta--alerta" };
  }

  return { etiqueta: "Sin invitación", clase: "etiqueta--alerta" };
}
