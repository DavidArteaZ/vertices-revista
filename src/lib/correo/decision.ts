import "server-only";
import { ordinalEdicionEs, ordinalEn, type DecisionFinal } from "@/lib/decisiones-finales";
import { mandarPlantilla, type Envio } from "./enviar";

export type AvisoDecision = {
  a: string;
  nombre: string;
  genero: string;
  decision: DecisionFinal;
  comentarios: string;
  locale: string;
  edicion: {
    numero: number;
    fecha_lanzamiento: string | null;
    ubicacion_evento_lanzamiento: string | null;
    fecha_limite_revisiones: string | null;
  };
};

type CorreoPreparado = {
  plantilla: string;
  variables: Record<string, string | number>;
};

function fechaLarga(fecha: string | null, ingles: boolean): string {
  if (!fecha) return ingles ? "to be decided" : "por decidir";
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const valor = new Date(Date.UTC(anio, mes - 1, dia, 12));
  return new Intl.DateTimeFormat(ingles ? "en-US" : "es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(valor);
}

function ubicacion(valor: string | null, ingles: boolean): string {
  const limpia = valor?.trim();
  return limpia || (ingles ? "to be decided" : "por decidir");
}

function plantilla(nombre: "aprobacion" | "rechazo" | "mayores", ingles: boolean): string {
  if (nombre === "aprobacion") {
    return ingles
      ? process.env.RESEND_APROBACION_TEMPLATE_ENG || "aprobacion_ENG"
      : process.env.RESEND_APROBACION_TEMPLATE_ES || "aprobacion_es-1";
  }
  if (nombre === "rechazo") {
    return ingles
      ? process.env.RESEND_RECHAZO_TEMPLATE_ENG || "rechazado_eng"
      : process.env.RESEND_RECHAZO_TEMPLATE_ES || "rechazado_es";
  }
  return ingles
    ? process.env.RESEND_REVISIONES_MAYORES_TEMPLATE_ENG || "revisionesmayores_eng"
    : process.env.RESEND_REVISIONES_MAYORES_TEMPLATE_ES || "revisionesmayores_es";
}

/**
 * Sólo español usa las plantillas españolas. Los otros idiomas del portal usan
 * las inglesas y los comentarios se envían tal como los escribió el comité.
 */
export function prepararCorreoDecision(a: AvisoDecision): CorreoPreparado {
  const ingles = a.locale !== "es";
  const nEdicion = ingles ? ordinalEn(a.edicion.numero) : ordinalEdicionEs(a.edicion.numero);
  const fecha = fechaLarga(a.edicion.fecha_lanzamiento, ingles);
  const limite = fechaLarga(a.edicion.fecha_limite_revisiones, ingles);
  const lugar = ubicacion(a.edicion.ubicacion_evento_lanzamiento, ingles);

  if (a.decision === "Aceptada" || a.decision === "Aceptada con revisiones menores") {
    const status = a.decision === "Aceptada"
      ? (ingles ? "Accepted" : "Aceptada")
      : (ingles ? "Accepted with minor revisions" : "Aceptada con revisiones menores");

    const variables: Record<string, string | number> = ingles
      ? {
          date: fecha,
          location: lugar,
          n_edition: nEdicion,
          nombre: a.nombre,
          status,
        }
      : {
          fecha,
          genero: a.genero,
          n_edition: nEdicion,
          nombre: a.nombre,
          status,
          ubi: lugar,
        };

    if (a.decision === "Aceptada con revisiones menores") {
      variables.comentarios = a.comentarios;
    }

    return { plantilla: plantilla("aprobacion", ingles), variables };
  }

  if (a.decision === "Rechazado") {
    return {
      plantilla: plantilla("rechazo", ingles),
      variables: ingles
        ? {
            comments: a.comentarios,
            n_edition: nEdicion,
            nombre: a.nombre,
          }
        : {
            comentarios: a.comentarios,
            genero: a.genero,
            n_edition: nEdicion,
            nombre: a.nombre,
          },
    };
  }

  return {
    plantilla: plantilla("mayores", ingles),
    variables: ingles
      ? {
          comentarios: a.comentarios,
          fecha_limite: limite,
          n_edition: nEdicion,
          nombre: a.nombre,
        }
      : {
          comentarios: a.comentarios,
          fecha_limite: limite,
          genero: a.genero,
          n_edition: nEdicion,
          nombre: a.nombre,
        },
  };
}

export function enviarDecision(a: AvisoDecision): Promise<Envio> {
  const correo = prepararCorreoDecision(a);
  return mandarPlantilla(a.a, correo.plantilla, correo.variables);
}
