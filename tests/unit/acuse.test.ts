import { afterEach, describe, expect, it } from "vitest";
import { plantillaDeLocale } from "@/lib/correo/acuse";
import { LOCALES } from "@/i18n/rutas";

/**
 * Elegir mal la plantilla no rompe nada visible: el acuse sale, sólo que en el
 * idioma equivocado. Por eso se prueba aquí y no se confía en verlo.
 */

const ORIGINAL = { ...process.env };

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

  it("sin plantilla configurada no devuelve nada y el acuse cae a texto plano", () => {
    delete process.env.RESEND_CONFIRMACION_TEMPLATE_ES;
    delete process.env.RESEND_CONFIRMACION_TEMPLATE_ENG;
    expect(plantillaDeLocale("es")).toBeUndefined();
    expect(plantillaDeLocale("fr")).toBeUndefined();
  });
});
