import { afterEach, describe, expect, it } from "vitest";
import { prepararCorreoDecision, type AvisoDecision } from "@/lib/correo/decision";
import { ordinalEdicionEs, ordinalEn } from "@/lib/decisiones-finales";

const ORIGINAL = { ...process.env };

const BASE: AvisoDecision = {
  a: "autora@ejemplo.test",
  nombre: "Ana Herrera",
  genero: "Femenino",
  decision: "Aceptada",
  comentarios: "",
  locale: "es",
  nombre_pieza: "Una pieza de prueba",
  folio: "VTX-2026-123",
  edicion: {
    numero: 1,
    fecha_lanzamiento: "2026-11-13",
    ubicacion_evento_lanzamiento: "Campus Ciudad de México",
    fecha_limite_revisiones: "2026-10-30",
  },
};

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("ordinales de edición", () => {
  it("usa ordinal femenino en español", () => {
    expect(ordinalEdicionEs(1)).toBe("1era");
    expect(ordinalEdicionEs(2)).toBe("2da");
    expect(ordinalEdicionEs(3)).toBe("3era");
    expect(ordinalEdicionEs(4)).toBe("4ta");
    expect(ordinalEdicionEs(10)).toBe("10ma");
  });

  it("usa ordinal inglés y respeta 11th, 12th y 13th", () => {
    expect(ordinalEn(1)).toBe("1st");
    expect(ordinalEn(2)).toBe("2nd");
    expect(ordinalEn(3)).toBe("3rd");
    expect(ordinalEn(4)).toBe("4th");
    expect(ordinalEn(11)).toBe("11th");
    expect(ordinalEn(12)).toBe("12th");
    expect(ordinalEn(13)).toBe("13th");
    expect(ordinalEn(21)).toBe("21st");
  });
});

describe("prepararCorreoDecision", () => {
  it("prepara aceptación en español con fecha escrita", () => {
    delete process.env.RESEND_APROBACION_TEMPLATE_ES;
    expect(prepararCorreoDecision(BASE)).toEqual({
      plantilla: "aprobacion_es-1",
      variables: {
        nombre_pieza: "Una pieza de prueba",
        folio: "VTX-2026-123",
        fecha: "13 de noviembre de 2026",
        genero: "a",
        n_edition: "1era",
        nombre: "Ana Herrera",
        status: "Aceptada",
        ubi: "Campus Ciudad de México",
      },
    });
  });

  it("convierte el género del autor en la terminación para Estimad_", () => {
    expect(prepararCorreoDecision({ ...BASE, genero: "Masculino" }).variables.genero).toBe("o");
    expect(prepararCorreoDecision({ ...BASE, genero: "Femenino" }).variables.genero).toBe("a");
    expect(prepararCorreoDecision({ ...BASE, genero: "Otro" }).variables.genero).toBe("e");
    expect(prepararCorreoDecision({ ...BASE, genero: "No binario" }).variables.genero).toBe("e");
  });

  it("usa la terminación también en rechazo y revisiones mayores en español", () => {
    const rechazo = prepararCorreoDecision({
      ...BASE,
      genero: "Masculino",
      decision: "Rechazado",
      comentarios: "No corresponde a la edición.",
    });
    expect(rechazo.variables.genero).toBe("o");

    const mayores = prepararCorreoDecision({
      ...BASE,
      genero: "Otro",
      decision: "Revisiones mayores",
      comentarios: "Replantear el método.",
    });
    expect(mayores.variables.genero).toBe("e");
  });

  it("usa inglés para cualquier locale distinto de español", () => {
    delete process.env.RESEND_APROBACION_TEMPLATE_ENG;
    expect(preparCorreo({ ...BASE, locale: "fr", edicion: { ...BASE.edicion, numero: 2 } })).toEqual({
      plantilla: "aprobacion_ENG",
      variables: {
        nombre_pieza: "Una pieza de prueba",
        folio: "VTX-2026-123",
        date: "November 13, 2026",
        location: "Campus Ciudad de México",
        n_edition: "2nd",
        nombre: "Ana Herrera",
        status: "Accepted",
      },
    });
  });

  it("incluye comentarios y el status completo para revisiones menores", () => {
    const correoEs = prepararCorreoDecision({
      ...BASE,
      decision: "Aceptada con revisiones menores",
      comentarios: "Ajustar las referencias.",
    });
    expect(correoEs.variables.status).toBe("Aceptada con revisiones menores");
    expect(correoEs.variables.comentarios).toBe("Ajustar las referencias.");
    expect(correoEs.variables.nombre_pieza).toBe("Una pieza de prueba");
    expect(correoEs.variables.folio).toBe("VTX-2026-123");

    const correoEn = prepararCorreoDecision({
      ...BASE,
      locale: "pt",
      decision: "Aceptada con revisiones menores",
      comentarios: "Please adjust the references.",
    });
    expect(correoEn.variables.status).toBe("Accepted with minor revisions");
    expect(correoEn.variables.comentarios).toBe("Please adjust the references.");
    expect(correoEn.variables.nombre_pieza).toBe("Una pieza de prueba");
    expect(correoEn.variables.folio).toBe("VTX-2026-123");
  });

  it("usa comments en el rechazo inglés", () => {
    delete process.env.RESEND_RECHAZO_TEMPLATE_ENG;
    expect(prepararCorreoDecision({
      ...BASE,
      locale: "en",
      decision: "Rechazado",
      comentarios: "The scope does not fit the issue.",
    })).toEqual({
      plantilla: "rechazado_eng",
      variables: {
        nombre_pieza: "Una pieza de prueba",
        folio: "VTX-2026-123",
        comments: "The scope does not fit the issue.",
        n_edition: "1st",
        nombre: "Ana Herrera",
      },
    });
  });

  it("escribe la fecha límite en palabras para revisiones mayores", () => {
    delete process.env.RESEND_REVISIONES_MAYORES_TEMPLATE_ES;
    delete process.env.RESEND_REVISIONES_MAYORES_TEMPLATE_ENG;

    const es = prepararCorreoDecision({
      ...BASE,
      decision: "Revisiones mayores",
      comentarios: "Replantear el método.",
    });
    expect(es.plantilla).toBe("revisionesmayores_es");
    expect(es.variables.fecha_limite).toBe("30 de octubre de 2026");
    expect(es.variables.nombre_pieza).toBe("Una pieza de prueba");
    expect(es.variables.folio).toBe("VTX-2026-123");

    const en = prepararCorreoDecision({
      ...BASE,
      locale: "ru",
      decision: "Revisiones mayores",
      comentarios: "Please reconsider the method.",
    });
    expect(en.plantilla).toBe("revisionesmayores_eng");
    expect(en.variables.fecha_limite).toBe("October 30, 2026");
    expect(en.variables.nombre_pieza).toBe("Una pieza de prueba");
    expect(en.variables.folio).toBe("VTX-2026-123");
  });

  it("convierte los parámetros no definidos a por decidir / to be decided", () => {
    const sinParametros: AvisoDecision = {
      ...BASE,
      edicion: {
        ...BASE.edicion,
        fecha_lanzamiento: null,
        ubicacion_evento_lanzamiento: null,
        fecha_limite_revisiones: null,
      },
    };

    const es = prepararCorreoDecision(sinParametros);
    expect(es.variables.fecha).toBe("por decidir");
    expect(es.variables.ubi).toBe("por decidir");

    const en = prepararCorreoDecision({ ...sinParametros, locale: "it" });
    expect(en.variables.date).toBe("to be decided");
    expect(en.variables.location).toBe("to be decided");
  });
});

function preparCorreo(aviso: AvisoDecision) {
  return prepararCorreoDecision(aviso);
}
