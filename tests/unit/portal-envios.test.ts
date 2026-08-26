import { describe, expect, it } from "vitest";
import {
  CAMPOS_SECCION,
  CLAVES_CAMPO_SECCION,
  ETIQUETA_ROL,
  GENEROS_ENVIO,
  MODALIDADES_ENTREVISTA,
  ROLES_ARCHIVO,
  SECCIONES_ENVIO,
  camposDeSeccion,
  esGeneroEnvio,
  esModalidadEntrevista,
  etiquetaRol,
  rolPermitido,
  tipoDeSeccion,
  type RolArchivo,
  type SeccionEnvio,
} from "@/lib/datos/portal-envios";

/**
 * Los roles que admite cada sección, transcritos del PDF del comité y no
 * importados del módulo: si alguien cambia ROLES_POR_SECCION sin querer, la
 * comparación tiene que fallar. Una sección nueva rompe la primera afirmación
 * de «cubre las siete secciones», que es la señal de que falta declarar sus
 * roles aquí y allá.
 */
const ROLES_ESPERADOS: Record<SeccionEnvio, readonly RolArchivo[]> = {
  Datanomics: ["visualizacion"],
  "La Voz de la Experiencia": ["foto", "cesion_imagen"],
  "Miradas Económicas": ["paper", "anexo"],
  "Horizonte Global": ["articulo"],
  "¿Sabías Qué?": ["foto"],
  "Capital Social": ["foto"],
  "Excelencia en Acción": ["foto", "cesion_imagen"],
};

describe("la tabla única de campos", () => {
  it("declara etiqueta y secciones reales para los ocho campos", () => {
    expect(CLAVES_CAMPO_SECCION).toHaveLength(8);
    for (const clave of CLAVES_CAMPO_SECCION) {
      const campo = CAMPOS_SECCION[clave];
      expect(campo.etiqueta.trim().length).toBeGreaterThan(0);
      expect(campo.secciones.length).toBeGreaterThan(0);
      for (const s of campo.secciones) expect(SECCIONES_ENVIO).toContain(s);
    }
  });

  it("da al menos un campo a cada una de las siete secciones", () => {
    // Una sección sin campos dejaría al autor con el paso 2 en blanco y al
    // comité con la tarjeta «Contenido de la pieza» siempre vacía.
    for (const s of SECCIONES_ENVIO) expect(camposDeSeccion(s).length).toBeGreaterThan(0);
  });

  it("devuelve los campos en el orden declarado, que es el de lectura del panel", () => {
    expect(CLAVES_CAMPO_SECCION).toEqual(Object.keys(CAMPOS_SECCION));
    expect(camposDeSeccion("Datanomics")).toEqual(["textoExplicativo", "repositorio"]);
    expect(camposDeSeccion("Excelencia en Acción")).toEqual(["semblanza", "cronica"]);
  });

  it("no inventa campos para una sección que no existe", () => {
    expect(camposDeSeccion("")).toEqual([]);
    expect(camposDeSeccion("Datanómics")).toEqual([]);
  });
});

describe("rolPermitido", () => {
  it("cubre las siete secciones y sólo las siete", () => {
    expect(Object.keys(ROLES_ESPERADOS).sort()).toEqual([...SECCIONES_ENVIO].sort());
  });

  it("admite los roles de cada sección y rechaza todos los demás", () => {
    for (const seccion of SECCIONES_ENVIO) {
      for (const rol of ROLES_ARCHIVO) {
        const admitido = ROLES_ESPERADOS[seccion].includes(rol);
        expect(rolPermitido(seccion, rol), `${seccion} · ${rol}`).toBe(admitido);
      }
    }
  });

  it("no deja ninguna sección sin roles", () => {
    // Invariante estructural: ROLES_POR_SECCION es privado, así que se
    // comprueba por su efecto. Una sección añadida arriba y olvidada abajo
    // haría fallar aquí y no en producción, con el autor sin poder adjuntar.
    for (const seccion of SECCIONES_ENVIO) {
      expect(ROLES_ARCHIVO.some((rol) => rolPermitido(seccion, rol)), seccion).toBe(true);
    }
  });

  it("rechaza cualquier rol cuando la sección no es válida", () => {
    // Es la guarda contra peticiones manipuladas: sin sección reconocida no
    // hay archivo que valga.
    for (const rol of ROLES_ARCHIVO) {
      expect(rolPermitido("", rol)).toBe(false);
      expect(rolPermitido("Miradas", rol)).toBe(false);
    }
  });
});

describe("los catálogos cerrados", () => {
  it("esGeneroEnvio acepta el catálogo entero y nada más", () => {
    // El género viaja como variable a Resend; fuera del catálogo es texto que
    // controla quien manda la petición.
    for (const g of GENEROS_ENVIO) expect(esGeneroEnvio(g)).toBe(true);
    expect(esGeneroEnvio("")).toBe(false);
    expect(esGeneroEnvio("femenino")).toBe(false);
    expect(esGeneroEnvio("Prefiero no responder")).toBe(false);
    expect(esGeneroEnvio("<script>")).toBe(false);
  });

  it("esModalidadEntrevista acepta el catálogo entero y nada más", () => {
    for (const m of MODALIDADES_ENTREVISTA) expect(esModalidadEntrevista(m)).toBe(true);
    expect(esModalidadEntrevista("")).toBe(false);
    expect(esModalidadEntrevista("en línea")).toBe(false);
    expect(esModalidadEntrevista("En linea")).toBe(false);
    expect(esModalidadEntrevista("Online")).toBe(false);
  });
});

describe("tipoDeSeccion", () => {
  it("da un tipo a cada una de las siete secciones", () => {
    expect(SECCIONES_ENVIO.map(tipoDeSeccion)).toEqual([
      "Visualización",
      "Entrevista",
      "Paper/Investigación",
      "Artículo",
      "Cápsula",
      "Crónica",
      "Crónica",
    ]);
  });

  it("devuelve null cuando la sección no se reconoce", () => {
    expect(tipoDeSeccion("")).toBeNull();
    expect(tipoDeSeccion("Datanomics ")).toBeNull();
    expect(tipoDeSeccion("Editorial")).toBeNull();
  });
});

describe("las etiquetas de rol", () => {
  it("pone nombre a todos los roles del formulario", () => {
    for (const rol of ROLES_ARCHIVO) expect(ETIQUETA_ROL[rol].trim().length).toBeGreaterThan(0);
  });

  it("tolera 'adjunto', que la base admite y el formulario nunca manda", () => {
    // Es el valor por defecto de la columna: los envíos anteriores a los roles
    // llegan con él y el chip del panel no puede quedarse vacío.
    expect(ROLES_ARCHIVO as readonly string[]).not.toContain("adjunto");
    expect(etiquetaRol("adjunto")).toBe("Adjunto");
  });

  it("enseña un rol desconocido legible en vez de dejar el chip mudo", () => {
    expect(etiquetaRol("cesion_imagen")).toBe("Cesión de imagen");
    expect(etiquetaRol("rol_que_no_conocemos")).toBe("rol que no conocemos");
  });
});
