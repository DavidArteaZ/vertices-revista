import { describe, it, expect } from "vitest";
import { validarPaso, vacio, type DatosEnvio } from "@/lib/validacion";

const palabras = (n: number) => Array(n).fill("palabra").join(" ");

const paso0: DatosEnvio = {
  ...vacio,
  nombre: "Ana Herrera",
  correo: "a@b.mx",
  perfil: "Científico(a) de datos",
  afiliacion: "Tec CCM",
};

describe("paso 0 — autoría", () => {
  it("requires a name", () =>
    expect(validarPaso(0, { ...paso0, nombre: "" }, [])).toBe("Escribe tu nombre completo."));
  it("rejects a malformed email", () =>
    expect(validarPaso(0, { ...paso0, correo: "no-es-correo" }, [])).toBe("Escribe un correo de contacto válido."));
  it("rejects an email with spaces", () =>
    expect(validarPaso(0, { ...paso0, correo: "a b@c.mx" }, [])).toBe("Escribe un correo de contacto válido."));
  it("requires a profile", () =>
    expect(validarPaso(0, { ...paso0, perfil: "" }, [])).toBe("Elige tu perfil de autor."));
  it("requires an affiliation", () =>
    expect(validarPaso(0, { ...paso0, afiliacion: "" }, [])).toBe("Indica tu institución o afiliación."));
  it("passes when complete", () => expect(validarPaso(0, paso0, [])).toBeNull());
  it("treats whitespace-only as empty", () =>
    expect(validarPaso(0, { ...paso0, nombre: "   " }, [])).toBe("Escribe tu nombre completo."));
});

const paso1: DatosEnvio = {
  ...paso0,
  titulo: "T",
  formato: "Cápsula breve",
  seccion: "Datanomics",
  tema: "Fintech",
  resumen: palabras(150),
  claves: "a, b, c",
};

describe("paso 1 — manuscrito", () => {
  it("requires a title", () =>
    expect(validarPaso(1, { ...paso1, titulo: "" }, [])).toBe("Tu manuscrito necesita un título."));
  it("requires a format", () =>
    expect(validarPaso(1, { ...paso1, formato: "" }, [])).toBe("Elige el formato de tu pieza."));
  it("requires a section", () =>
    expect(validarPaso(1, { ...paso1, seccion: "" }, [])).toBe("Elige la sección que mejor le queda a tu trabajo."));
  it("requires a topic", () =>
    expect(validarPaso(1, { ...paso1, tema: "" }, [])).toBe("Elige el tema principal."));
  it("rejects a summary under 100 words, reporting the count", () =>
    expect(validarPaso(1, { ...paso1, resumen: palabras(99) }, [])).toBe(
      "El resumen lleva 99 palabras; se piden al menos 100.",
    ));
  it("accepts exactly 100 words", () =>
    expect(validarPaso(1, { ...paso1, resumen: palabras(100) }, [])).toBeNull());
  it("accepts exactly 300 words", () =>
    expect(validarPaso(1, { ...paso1, resumen: palabras(300) }, [])).toBeNull());
  it("rejects 301 words", () =>
    expect(validarPaso(1, { ...paso1, resumen: palabras(301) }, [])).toBe(
      "El resumen lleva 301 palabras; el máximo es 300.",
    ));
  it("rejects fewer than 3 keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a, b" }, [])).toBe(
      "Escribe de 3 a 5 palabras clave separadas por comas.",
    ));
  it("accepts exactly 5 keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a,b,c,d,e" }, [])).toBeNull());
  it("rejects more than 5 keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a,b,c,d,e,f" }, [])).toBe(
      "Escribe de 3 a 5 palabras clave separadas por comas.",
    ));
  it("ignores trailing separators when counting keywords", () =>
    expect(validarPaso(1, { ...paso1, claves: "a, b, c," }, [])).toBeNull());
});

describe("paso 2 — archivos", () => {
  it("requires at least one file", () =>
    expect(validarPaso(2, paso1, [])).toBe("Adjunta tu manuscrito en .docx o .pdf."));
  it("passes with one", () =>
    expect(validarPaso(2, paso1, [{ name: "m.pdf", size: 100 }])).toBeNull());
});

describe("paso 3 — declaración", () => {
  const listo: DatosEnvio = { ...paso1, usoIA: "No", d1: true, d2: true, d3: true, d4: true };
  it("requires the AI declaration", () =>
    expect(validarPaso(3, { ...listo, usoIA: "" }, [])).toBe(
      "Indica si usaste herramientas de inteligencia artificial.",
    ));
  it("requires all four checkboxes", () => {
    for (const k of ["d1", "d2", "d3", "d4"] as const) {
      expect(validarPaso(3, { ...listo, [k]: false }, []), `sin ${k}`).toBe(
        "Confirma las cuatro declaraciones para poder enviar.",
      );
    }
  });
  it("passes when all four are checked", () => expect(validarPaso(3, listo, [])).toBeNull());
});
