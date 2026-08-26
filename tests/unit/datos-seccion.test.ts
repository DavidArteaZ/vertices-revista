import { describe, expect, it } from "vitest";
import { camposConTexto, enlaceRepositorio } from "@/app/panel/envios/[id]/datos-seccion";
import { CLAVES_CAMPO_SECCION } from "@/lib/datos/portal-envios";

/**
 * Lo que `/api/envios` guarda en `datos_seccion`: las ocho claves siempre, con
 * texto sólo en las de la sección elegida. Las pruebas parten de aquí para no
 * comprobar contra un JSON que la ruta nunca produce.
 */
const comoLoGuardaLaRuta = (lleno: Record<string, string>) =>
  Object.fromEntries(CLAVES_CAMPO_SECCION.map((c) => [c, lleno[c] ?? ""]));

describe("camposConTexto", () => {
  it("descarta las claves vacías que viajan siempre", () => {
    const datos = comoLoGuardaLaRuta({ cronica: "Llegamos al taller a las siete." });
    expect(Object.keys(datos)).toHaveLength(8);
    expect(camposConTexto(datos)).toEqual([
      { clave: "cronica", etiqueta: "Crónica", texto: "Llegamos al taller a las siete." },
    ]);
  });

  it("trata el texto en blanco como campo sin escribir", () => {
    expect(camposConTexto(comoLoGuardaLaRuta({ dato: "   \n  " }))).toEqual([]);
  });

  it("recorta los espacios de alrededor y conserva los saltos de párrafo", () => {
    // El `pre-wrap` del panel es lo que deja copiar la crónica a la plantilla
    // del comité; recortar los extremos no puede llevarse los saltos de dentro.
    const [campo] = camposConTexto(comoLoGuardaLaRuta({ cronica: "  Uno.\n\nDos.  " }));
    expect(campo.texto).toBe("Uno.\n\nDos.");
  });

  it("respeta el orden declarado y no el de las claves del JSON", () => {
    // El orden es editorial: si se pintara el del JSON, dos envíos de la misma
    // sección podrían leerse en orden distinto.
    const alreves = {
      repositorio: "https://osf.io/abc",
      piesImagen: "Foto 1: el taller",
      cronica: "La crónica",
      semblanza: "La semblanza",
    };
    expect(camposConTexto(alreves).map((c) => c.clave)).toEqual([
      "semblanza",
      "cronica",
      "piesImagen",
      "repositorio",
    ]);
  });

  it("ignora las claves que no reconoce", () => {
    // Un envío hecho con otra versión del formulario no puede colar un campo
    // en la ficha del comité.
    const datos = { ...comoLoGuardaLaRuta({ dato: "El 40% no lo sabía." }), notaInterna: "ojo" };
    expect(camposConTexto(datos).map((c) => c.clave)).toEqual(["dato"]);
  });

  it("ignora los valores que no son texto", () => {
    const datos = { ...comoLoGuardaLaRuta({}), dato: 42, cronica: null, semblanza: ["a"] };
    expect(camposConTexto(datos)).toEqual([]);
  });

  it("cae al resumen en los envíos anteriores a la migración", () => {
    // La regresión que importa: `datos_seccion` nulo o con forma inesperada
    // devuelve lista vacía —nunca revienta—, y esa lista vacía es justo la
    // condición con la que DatosSeccion pinta `envio.resumen` en su lugar.
    for (const viejo of [null, undefined, {}, [], "resumen suelto", 0]) {
      expect(camposConTexto(viejo), String(viejo)).toEqual([]);
    }
  });
});

describe("enlaceRepositorio", () => {
  it("enlaza sólo lo que se puede seguir", () => {
    expect(enlaceRepositorio("https://osf.io/abc")).toBe("https://osf.io/abc");
    expect(enlaceRepositorio("http://datos.gob.mx/x")).toBe("http://datos.gob.mx/x");
  });

  it("no enlaza el texto libre que llega en ese campo", () => {
    expect(enlaceRepositorio("pendiente")).toBeNull();
    expect(enlaceRepositorio("10.1234/zenodo.999")).toBeNull();
    expect(enlaceRepositorio("")).toBeNull();
  });

  it("descarta los esquemas que no son web", () => {
    // `new URL` acepta `javascript:` y `data:` tan contento; el filtro de
    // protocolo es lo que impide que un envío ponga eso en un href del panel.
    expect(enlaceRepositorio("javascript:alert(1)")).toBeNull();
    expect(enlaceRepositorio("data:text/html,<script>")).toBeNull();
    expect(enlaceRepositorio("ftp://archivo.mx/datos.zip")).toBeNull();
  });
});
