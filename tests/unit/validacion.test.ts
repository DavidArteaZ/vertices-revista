import { describe, expect, it } from "vitest";
import {
  AVISO,
  validarEnvio,
  validarPaso,
  vacio,
  type Aviso,
  type CamposSeccion,
  type DatosEnvio,
} from "@/lib/validacion";
import type { RolArchivo } from "@/lib/datos/portal-envios";
import es from "../../messages/es.json";

const catalogo = es.avisos as Record<string, string>;

/**
 * Resuelve la clave contra el catálogo español e interpola igual que ICU.
 *
 * Lo que hay que garantizar no es que el código devuelva una clave, sino que la
 * persona lea una frase. `portal_miradas_paper_max_35_paginas` llegó a
 * producción devolviéndose desde el servidor sin texto en ningún catálogo: el
 * autor veía el nombre de la clave en bruto. Esa clase de fallo sólo se ve si
 * cada aviso que una prueba dispara pasa por aquí.
 */
const mensaje = (a: Aviso | null): string | null => {
  if (!a) return null;
  const plantilla = catalogo[a.clave];
  expect(plantilla, `avisos.${a.clave} no está en messages/es.json`).toBeDefined();
  return Object.entries(a.valores ?? {}).reduce(
    (txt, [k, val]) => txt.replaceAll(`{${k}}`, String(val)),
    plantilla,
  );
};

const palabras = (n: number) => Array(n).fill("palabra").join(" ");
const archivo = (rol: RolArchivo, name = "a.pdf", size = 100) => ({ name, size, rol });

/** Devuelve la clave, pero de paso comprueba que esa clave tiene texto. */
const clave = (...args: Parameters<typeof validarPaso>) => {
  const a = validarPaso(...args);
  mensaje(a);
  return a?.clave ?? null;
};

const claveEnvio = (...args: Parameters<typeof validarEnvio>) => {
  const a = validarEnvio(...args);
  mensaje(a);
  return a?.clave ?? null;
};

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

/**
 * La red que ata las claves al código.
 *
 * Recorre el catálogo entero, no sólo las claves que alguna prueba dispara: las
 * que nadie dispara son justo las que se rompen sin que nada avise, y son la
 * categoría del fallo de las 35 cuartillas.
 */
describe("el catálogo de avisos", () => {
  it("tiene texto en español para todas sus claves, las dispare alguien o no", () => {
    for (const [prop, cl] of Object.entries(AVISO)) {
      expect(catalogo[cl], `AVISO.${prop} → avisos.${cl} no está en messages/es.json`).toBeTruthy();
    }
  });

  it("no repite la misma clave en dos propiedades", () => {
    const claves = Object.values(AVISO);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("interpola el nombre del archivo en las claves que lo llevan", () => {
    expect(mensaje({ clave: AVISO.subida, valores: { a: "grafica.png" } })).toBe(
      'No pudimos subir "grafica.png". Vuelve a intentarlo.',
    );
    expect(mensaje({ clave: AVISO.peso, valores: { a: "foto.jpg" } })).toBe(
      '"foto.jpg" pesa más de 20 MB.',
    );
  });

  it("lo que le llega al autor es la frase, no el nombre de la clave", () => {
    expect(mensaje(validarPaso(1, { ...pieza, claves: "a,b" }, []))).toBe(
      "Escribe de 3 a 5 palabras clave separadas por comas.",
    );
  });
});

describe("paso 0 — autoría", () => {
  it("pide nombre, perfil y afiliación", () => {
    expect(clave(0, { ...autoria, nombre: "" }, [])).toBe("escribe_tu_nombre_completo");
    expect(clave(0, { ...autoria, nombre: "   " }, [])).toBe("escribe_tu_nombre_completo");
    expect(clave(0, { ...autoria, perfil: "" }, [])).toBe("elige_tu_perfil_de_autor");
    expect(clave(0, { ...autoria, afiliacion: "" }, [])).toBe("indica_tu_institucion_o_afiliacion");
    expect(clave(0, autoria, [])).toBeNull();
  });

  it("rechaza un correo malformado y uno con espacios", () => {
    expect(clave(0, { ...autoria, correo: "" }, [])).toBe("escribe_un_correo_de_contacto_valido");
    expect(clave(0, { ...autoria, correo: "no-es-correo" }, [])).toBe("escribe_un_correo_de_contacto_valido");
    expect(clave(0, { ...autoria, correo: "a b@c.mx" }, [])).toBe("escribe_un_correo_de_contacto_valido");
  });

  it("admite hasta dos coautores y no cuenta las comas sobrantes", () => {
    expect(clave(0, { ...autoria, coautores: "" }, [])).toBeNull();
    expect(clave(0, { ...autoria, coautores: "Beto Ruiz" }, [])).toBeNull();
    expect(clave(0, { ...autoria, coautores: "Beto Ruiz, Cris Lima" }, [])).toBeNull();
    expect(clave(0, { ...autoria, coautores: "a, b," }, [])).toBeNull();
    expect(clave(0, { ...autoria, coautores: "a, b, c" }, [])).toBe("portal_coautores_max_2");
  });

  it("exige una sección del catálogo", () => {
    expect(clave(0, { ...autoria, seccion: "" }, [])).toBe("elige_la_seccion_que_mejor_le_queda_a_tu_trabajo");
    expect(clave(0, { ...autoria, seccion: "Sección inventada" }, [])).toBe(
      "elige_la_seccion_que_mejor_le_queda_a_tu_trabajo",
    );
  });

  /** El género viaja como variable de plantilla hasta Resend: no basta con que no esté vacío. */
  it("exige un género del catálogo, no cualquier cadena", () => {
    for (const g of ["Prefiero no responder aquí", "Femenino", "Masculino", "Otro"]) {
      expect(clave(0, { ...autoria, genero: g }, []), g).toBeNull();
    }
    expect(clave(0, { ...autoria, genero: "" }, [])).toBe("portal_genero_requerido");
    expect(clave(0, { ...autoria, genero: "<script>" }, [])).toBe("portal_genero_requerido");
  });
});

describe("paso 1 — información de la pieza", () => {
  it("pide título, tema y de 3 a 5 palabras clave", () => {
    expect(clave(1, { ...pieza, titulo: "" }, [])).toBe("tu_manuscrito_necesita_un_titulo");
    expect(clave(1, { ...pieza, tema: "" }, [])).toBe("elige_el_tema_principal");
    expect(clave(1, { ...pieza, claves: "a,b" }, [])).toBe("escribe_de_3_a_5_palabras_clave_separadas_por_co_414e");
    expect(clave(1, { ...pieza, claves: "a,b,c,d,e,f" }, [])).toBe("escribe_de_3_a_5_palabras_clave_separadas_por_co_414e");
    expect(clave(1, { ...pieza, claves: "a, b, c," }, [])).toBeNull();
    expect(clave(1, pieza, [])).toBeNull();
  });
});

/** Una pieza de la sección indicada, con sus campos rellenos salvo lo que se pise. */
const enSeccion = (seccion: string, campos: Partial<CamposSeccion>): DatosEnvio => ({
  ...pieza,
  seccion,
  campos: { ...pieza.campos, ...campos },
});

const datanomics = (n: number) => enSeccion("Datanomics", { textoExplicativo: palabras(n) });
const miradas = (n: number) => enSeccion("Miradas Económicas", { resumen: palabras(n) });
const horizonte = (n: number) => enSeccion("Horizonte Global", { resumen: palabras(n) });
const sabias = (n: number) => enSeccion("¿Sabías Qué?", { dato: palabras(n) });
const capital = (n: number, piesImagen = "Foto 1: la plaza") =>
  enSeccion("Capital Social", { cronica: palabras(n), piesImagen });
const voz = (campos: Partial<CamposSeccion> = {}) =>
  enSeccion("La Voz de la Experiencia", { semblanza: "Semblanza", modalidadEntrevista: "En línea", ...campos });
const excelencia = (campos: Partial<CamposSeccion> = {}) =>
  enSeccion("Excelencia en Acción", { semblanza: "Semblanza", cronica: palabras(300), ...campos });

describe("paso 2 — guardas comunes", () => {
  /** Inalcanzable desde el formulario; es la guarda contra peticiones manipuladas. */
  it("rechaza un archivo cuyo rol no corresponde a la sección", () => {
    expect(clave(2, datanomics(200), [archivo("paper")])).toBe("portal_rol_no_corresponde");
    expect(clave(2, voz(), [archivo("anexo")])).toBe("portal_rol_no_corresponde");
  });

  it("acepta el repositorio vacío o con http(s), y rechaza cualquier otro esquema", () => {
    const d = datanomics(200);
    const con = (repositorio: string) =>
      clave(2, { ...d, campos: { ...d.campos, repositorio } }, [archivo("visualizacion", "g.png")]);
    expect(con("")).toBeNull();
    expect(con("https://github.com/ana/datos")).toBeNull();
    expect(con("ftp://archivos.mx/datos")).toBe("portal_repositorio_url");
    expect(con("mi carpeta de Drive")).toBe("portal_repositorio_url");
  });
});

describe("paso 2 — requisitos por sección", () => {
  it("Datanomics: de 1 a 3 visualizaciones", () => {
    const d = datanomics(200);
    const vis = archivo("visualizacion", "g.png");
    expect(clave(2, d, [])).toBe("portal_datanomics_visualizacion_1_3");
    expect(clave(2, d, [vis])).toBeNull();
    expect(clave(2, d, [vis, vis, vis])).toBeNull();
    expect(clave(2, d, [vis, vis, vis, vis])).toBe("portal_datanomics_visualizacion_1_3");
  });

  it("La Voz de la Experiencia: semblanza, modalidad, una foto y su cesión", () => {
    const foto = archivo("foto", "retrato.jpg");
    const cesion = archivo("cesion_imagen", "cesion.pdf");
    expect(clave(2, voz({ semblanza: "" }), [foto, cesion])).toBe("portal_semblanza_requerida");
    expect(clave(2, voz({ modalidadEntrevista: "" }), [foto, cesion])).toBe("portal_modalidad_requerida");
    // Fuera del catálogo: no basta con que la modalidad venga escrita.
    expect(clave(2, voz({ modalidadEntrevista: "Por Zoom" }), [foto, cesion])).toBe("portal_modalidad_requerida");
    expect(clave(2, voz(), [cesion])).toBe("portal_foto_requerida");
    expect(clave(2, voz(), [foto])).toBe("portal_cesion_requerida");
    expect(clave(2, voz(), [foto, cesion])).toBeNull();
  });

  it("Miradas Económicas: un paper y hasta 3 anexos", () => {
    const d = miradas(100);
    expect(clave(2, d, [])).toBe("portal_miradas_paper_requerido");
    expect(clave(2, d, [archivo("paper"), archivo("paper")])).toBe("portal_miradas_paper_requerido");
    expect(clave(2, d, [archivo("paper")])).toBeNull();
    expect(clave(2, d, [archivo("paper"), archivo("anexo"), archivo("anexo"), archivo("anexo")])).toBeNull();
    expect(
      clave(2, d, [archivo("paper"), archivo("anexo"), archivo("anexo"), archivo("anexo"), archivo("anexo")]),
    ).toBe("portal_miradas_anexos_max_3");
  });

  it("Horizonte Global: exactamente un artículo", () => {
    const d = horizonte(150);
    expect(clave(2, d, [])).toBe("portal_horizonte_articulo_requerido");
    expect(clave(2, d, [archivo("articulo"), archivo("articulo")])).toBe("portal_horizonte_articulo_requerido");
    expect(clave(2, d, [archivo("articulo")])).toBeNull();
  });

  it("¿Sabías Qué?: la imagen es opcional pero como mucho una", () => {
    const d = sabias(30);
    const foto = archivo("foto", "f.jpg");
    expect(clave(2, d, [])).toBeNull();
    expect(clave(2, d, [foto])).toBeNull();
    expect(clave(2, d, [foto, foto])).toBe("portal_sabias_imagen_max_1");
  });

  it("Capital Social: de 1 a 4 fotos y sus pies de imagen", () => {
    const d = capital(500);
    const foto = archivo("foto", "f.jpg");
    expect(clave(2, d, [])).toBe("portal_capital_fotos_1_4");
    expect(clave(2, d, [foto, foto, foto, foto, foto])).toBe("portal_capital_fotos_1_4");
    expect(clave(2, capital(500, ""), [foto])).toBe("portal_capital_pies_requeridos");
    expect(clave(2, d, [foto, foto, foto, foto])).toBeNull();
  });

  it("Excelencia en Acción: semblanza, crónica, una foto y su cesión", () => {
    const foto = archivo("foto", "retrato.jpg");
    const cesion = archivo("cesion_imagen", "cesion.pdf");
    expect(clave(2, excelencia({ semblanza: "" }), [foto, cesion])).toBe("portal_semblanza_requerida");
    expect(clave(2, excelencia({ cronica: "" }), [foto, cesion])).toBe("portal_excelencia_cronica_requerida");
    expect(clave(2, excelencia(), [cesion])).toBe("portal_foto_requerida");
    expect(clave(2, excelencia(), [foto])).toBe("portal_cesion_requerida");
    expect(clave(2, excelencia(), [foto, cesion])).toBeNull();
  });
});

/**
 * Los bordes, uno por uno. Un `<` escrito donde iba un `<=` no cambia nada
 * salvo en estas cuatro cifras, y ahí rechaza un texto que el comité aceptaría.
 */
describe("paso 2 — los límites de palabras en su borde exacto", () => {
  it("Datanomics: 200 y 800 pasan, 199 y 801 no", () => {
    const vis = [archivo("visualizacion", "g.png")];
    expect(clave(2, datanomics(199), vis)).toBe("portal_datanomics_texto_200_800");
    expect(clave(2, datanomics(200), vis)).toBeNull();
    expect(clave(2, datanomics(800), vis)).toBeNull();
    expect(clave(2, datanomics(801), vis)).toBe("portal_datanomics_texto_200_800");
  });

  it("Miradas Económicas: 100 y 300 pasan, 99 y 301 no", () => {
    const con = (n: number) => clave(2, miradas(n), [archivo("paper")]);
    expect(con(99)).toBe("portal_miradas_resumen_100_300");
    expect(con(100)).toBeNull();
    expect(con(300)).toBeNull();
    expect(con(301)).toBe("portal_miradas_resumen_100_300");
  });

  it("Capital Social: 500 y 900 pasan, 499 y 901 no", () => {
    const con = (n: number) => clave(2, capital(n), [archivo("foto", "f.jpg")]);
    expect(con(499)).toBe("portal_capital_cronica_500_900");
    expect(con(500)).toBeNull();
    expect(con(900)).toBeNull();
    expect(con(901)).toBe("portal_capital_cronica_500_900");
  });

  it("los dos campos de 200 palabras: 200 pasa, 201 y el vacío no", () => {
    const conArticulo = (n: number) => clave(2, horizonte(n), [archivo("articulo")]);
    expect(conArticulo(0)).toBe("portal_horizonte_resumen_max_200");
    expect(conArticulo(200)).toBeNull();
    expect(conArticulo(201)).toBe("portal_horizonte_resumen_max_200");

    expect(clave(2, sabias(0), [])).toBe("portal_sabias_dato_max_200");
    expect(clave(2, sabias(200), [])).toBeNull();
    expect(clave(2, sabias(201), [])).toBe("portal_sabias_dato_max_200");
  });
});

describe("paso 3 — declaración", () => {
  const listo: DatosEnvio = {
    ...pieza,
    campos: { ...pieza.campos, textoExplicativo: palabras(200) },
    usoIA: "No",
    d1: true, d2: false, d3: true, d4: true, d5: true, d6: true,
  };

  it("mantiene d2 opcional y las otras cinco obligatorias", () => {
    expect(clave(3, listo, [])).toBeNull();
    expect(clave(3, { ...listo, usoIA: "" }, [])).toBe("indica_si_usaste_herramientas_de_inteligencia_ar_1e5d");
    for (const k of ["d1", "d3", "d4", "d5", "d6"] as const) {
      expect(clave(3, { ...listo, [k]: false }, []), `sin ${k}`).toBe(
        "confirma_las_cuatro_declaraciones_para_poder_env_9d6c",
      );
    }
  });
});

describe("validarEnvio — los topes del conjunto", () => {
  const completo: DatosEnvio = {
    ...capital(500),
    usoIA: "No",
    d1: true, d2: false, d3: true, d4: true, d5: true, d6: true,
  };
  const foto = (mb: number) => archivo("foto", "f.jpg", mb * 1048576);

  it("rechaza cuando entre todos los archivos se pasan de 50 MB", () => {
    expect(claveEnvio(completo, [foto(1)])).toBeNull();
    expect(claveEnvio(completo, [foto(13), foto(13), foto(13), foto(13)])).toBe(
      "entre_todos_los_archivos_se_pasan_de_50_mb",
    );
  });

  /**
   * El tope general de cinco archivos es hoy inalcanzable: ninguna sección
   * admite más de cuatro adjuntos, así que su propia regla salta antes. Queda
   * escrito para que quien suba el tope de una sección por encima de cinco vea
   * que este orden importa; el texto de la clave lo cubre la red del catálogo.
   */
  it("rechaza más de cinco archivos, aunque lo cace antes la regla de la sección", () => {
    const seis = Array.from({ length: 6 }, () => foto(1));
    expect(claveEnvio(completo, seis)).toBe("portal_capital_fotos_1_4");
  });
});
