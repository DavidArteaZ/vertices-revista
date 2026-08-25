import { describe, expect, it } from "vitest";
import { validarPaso, vacio, type DatosEnvio } from "@/lib/validacion";
import type { RolArchivo } from "@/lib/datos/portal-envios";

const palabras = (n: number) => Array(n).fill("palabra").join(" ");
const archivo = (rol: RolArchivo, name = "a.pdf") => ({ name, size: 100, rol });

const autoria: DatosEnvio = {
  ...vacio,
  campos: { ...vacio.campos },
  nombre: "Ana Herrera",
  correo: "a@b.mx",
  perfil: "Científico(a) de datos",
  afiliacion: "Tec CCM",
  seccion: "Datanomics",
  genero: "Prefiero no responder aquí",
};

const pieza: DatosEnvio = {
  ...autoria,
  titulo: "Título",
  tema: "Fintech",
  claves: "a, b, c",
};

const clave = (...args: Parameters<typeof validarPaso>) => validarPaso(...args)?.clave ?? null;

describe("paso 0 — autoría", () => {
  it("requiere los datos de autoría, la sección y el género", () => {
    expect(clave(0, { ...autoria, nombre: "" }, [])).toBe("escribe_tu_nombre_completo");
    expect(clave(0, { ...autoria, seccion: "" }, [])).toBe("elige_la_seccion_que_mejor_le_queda_a_tu_trabajo");
    expect(clave(0, { ...autoria, genero: "" }, [])).toBe("portal_genero_requerido");
    expect(clave(0, autoria, [])).toBeNull();
  });
});

describe("paso 1 — información de la pieza", () => {
  it("pide título, tema y de 3 a 5 palabras clave", () => {
    expect(clave(1, { ...pieza, titulo: "" }, [])).toBe("tu_manuscrito_necesita_un_titulo");
    expect(clave(1, { ...pieza, tema: "" }, [])).toBe("elige_el_tema_principal");
    expect(clave(1, { ...pieza, claves: "a,b" }, [])).toBe("escribe_de_3_a_5_palabras_clave_separadas_por_co_414e");
    expect(clave(1, pieza, [])).toBeNull();
  });
});

describe("paso 2 — requisitos por sección", () => {
  it("Datanomics: texto de 200–800 y 1–3 visualizaciones", () => {
    const d = { ...pieza, campos: { ...pieza.campos, textoExplicativo: palabras(200) } };
    expect(clave(2, { ...d, campos: { ...d.campos, textoExplicativo: palabras(199) } }, [archivo("visualizacion", "g.png")])).toBe("portal_datanomics_texto_200_800");
    expect(clave(2, d, [])).toBe("portal_datanomics_visualizacion_1_3");
    expect(clave(2, d, [archivo("visualizacion", "g.png")])).toBeNull();
  });

  it("Miradas Económicas: resumen de 100–300, paper y hasta 3 anexos", () => {
    const d = { ...pieza, seccion: "Miradas Económicas", campos: { ...pieza.campos, resumen: palabras(100) } };
    expect(clave(2, d, [])).toBe("portal_miradas_paper_requerido");
    expect(clave(2, d, [archivo("paper")])).toBeNull();
    expect(clave(2, d, [archivo("paper"), archivo("anexo"), archivo("anexo"), archivo("anexo"), archivo("anexo")])).toBe("portal_miradas_anexos_max_3");
  });

  it("¿Sabías Qué? permite no adjuntar imagen", () => {
    const d = { ...pieza, seccion: "¿Sabías Qué?", campos: { ...pieza.campos, dato: palabras(30) } };
    expect(clave(2, d, [])).toBeNull();
  });

  it("Capital Social exige crónica, fotos y pies", () => {
    const d = { ...pieza, seccion: "Capital Social", campos: { ...pieza.campos, cronica: palabras(500), piesImagen: "Foto 1" } };
    expect(clave(2, d, [])).toBe("portal_capital_fotos_1_4");
    expect(clave(2, d, [archivo("foto", "f.jpg")])).toBeNull();
  });
});

describe("paso 3 — declaración", () => {
  const listo: DatosEnvio = {
    ...pieza,
    usoIA: "No",
    d1: true, d2: false, d3: true, d4: true, d5: true, d6: true,
  };

  it("mantiene d2 opcional y las otras cinco obligatorias", () => {
    expect(clave(3, listo, [])).toBeNull();
    expect(clave(3, { ...listo, d5: false }, [])).toBe("confirma_las_cuatro_declaraciones_para_poder_env_9d6c");
  });
});
