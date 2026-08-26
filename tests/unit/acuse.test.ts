import { afterEach, describe, expect, it } from "vitest";
import {
  generoDePlantilla,
  plantillaDeLocale,
  variablesDeAcuse,
  type Acuse,
} from "@/lib/correo/acuse";
import { LOCALES } from "@/i18n/rutas";

/**
 * Elegir mal la plantilla no rompe nada visible: el acuse sale, sólo que en el
 * idioma equivocado. Por eso se prueba aquí y no se confía en verlo.
 */

const ORIGINAL = { ...process.env };

const ACUSE: Acuse = {
  a: "autora@ejemplo.test",
  nombre: "Autora de Prueba",
  folio: "VTX-2026-001",
  titulo: "Una pieza",
  seccion: "Datanomics",
  genero: "Femenino",
  locale: "es",
  origen: "https://vertices.test",
};

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("plantillaDeLocale", () => {
  it("el español usa su plantilla", () => {
    process.env.RESEND_CONFIRMACION_TEMPLATE_ES = "confirmacion_ES";
    process.env.RESEND_CONFIRMACION_TEMPLATE_ENG = "confirmacion_ENG";
    expect(plantillaDeLocale("es")).toBe("confirmacion_ES");
  });

  it("los otros cinco idiomas caen en la inglesa", () => {
    process.env.RESEND_CONFIRMACION_TEMPLATE_ES = "confirmacion_ES";
    process.env.RESEND_CONFIRMACION_TEMPLATE_ENG = "confirmacion_ENG";
    const otros = LOCALES.filter((locale) => locale !== "es");
    expect(otros.length).toBe(5);
    for (const locale of otros) {
      expect(plantillaDeLocale(locale)).toBe("confirmacion_ENG");
    }
  });

  it("usa los aliases del PDF si no hay override en el entorno", () => {
    delete process.env.RESEND_CONFIRMACION_TEMPLATE_ES;
    delete process.env.RESEND_CONFIRMACION_TEMPLATE_ENG;
    expect(plantillaDeLocale("es")).toBe("confirmacion_ES");
    expect(plantillaDeLocale("fr")).toBe("confirmacion_ENG");
  });
});

describe("generoDePlantilla", () => {
  it("convierte Masculino, Femenino y cualquier otra opción a o/a/e", () => {
    expect(generoDePlantilla("Masculino")).toBe("o");
    expect(generoDePlantilla("Femenino")).toBe("a");
    expect(generoDePlantilla("Otro")).toBe("e");
    expect(generoDePlantilla("Prefiero no responder aquí")).toBe("e");
  });
});

describe("variablesDeAcuse", () => {
  it("el correo español manda genero ya convertido", () => {
    expect(variablesDeAcuse(ACUSE)).toEqual({
      nombre: "Autora de Prueba",
      genero: "a",
      seccion: "Datanomics",
      nom_pieza: "Una pieza",
      folio: "VTX-2026-001",
    });
  });

  it("el correo inglés no manda la variable genero", () => {
    expect(variablesDeAcuse({ ...ACUSE, locale: "en" })).toEqual({
      nombre: "Autora de Prueba",
      seccion: "Datanomics",
      nom_pieza: "Una pieza",
      folio: "VTX-2026-001",
    });
  });
});
