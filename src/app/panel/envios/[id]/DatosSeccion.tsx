import type { Json } from "@/lib/supabase/tipos";
import { camposConTexto, enlaceRepositorio } from "./datos-seccion";

/**
 * El contenido de la pieza: el texto que el autor escribió en los campos de su
 * sección, tal cual lo escribió.
 *
 * Va etiqueta encima y texto debajo, no en la rejilla del bloque anterior: ahí
 * caben «Nivel A» y una fecha, aquí una crónica de 900 palabras. El
 * `pre-wrap` conserva los saltos de párrafo en pantalla y también al copiar,
 * que es como el comité lleva el texto a su plantilla.
 *
 * Los envíos anteriores al formulario por secciones no tienen `datos_seccion`,
 * así que el bloque cae al resumen y lo dice. Un hueco mudo se leería como
 * «el autor no escribió nada», y lo que pasa es otra cosa.
 */
export default function DatosSeccion({
  datosSeccion,
  resumen,
}: {
  datosSeccion: Json;
  resumen: string;
}) {
  const campos = camposConTexto(datosSeccion);
  const respaldo = resumen.trim();

  return (
    <>
      <h3>Contenido de la pieza</h3>
      <div className="tarjeta">
        {campos.length > 0 ? (
          <dl className="campos-seccion">
            {campos.map(({ clave, etiqueta, texto }) => {
              const url = clave === "repositorio" ? enlaceRepositorio(texto) : null;
              return (
                <div key={clave}>
                  <dt>{etiqueta}</dt>
                  <dd>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">{texto}</a>
                    ) : (
                      <p className="texto-largo">{texto}</p>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <>
            {respaldo && <p className="texto-largo">{respaldo}</p>}
            <p className="nota">
              {respaldo
                ? "Este envío llegó antes del formulario por secciones, así que sólo se guardó este resumen. El texto completo, si lo hay, está en los archivos."
                : "Este envío no guardó texto de sección ni resumen. Llegó antes del formulario por secciones; lo que mandó el autor está en los archivos."}
            </p>
          </>
        )}
      </div>
    </>
  );
}
