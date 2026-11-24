import Accion from "../../Accion";
import PdfPieza from "./PdfPieza";
import { ajustarArticulo, quitarArticulo } from "../acciones";
import { agregarPiezaTitulo, quitarPiezaTitulo } from "../piezas-titulo";

/**
 * Las piezas del número, agrupadas por sección en el orden de la revista y
 * cada sección plegable.
 *
 * Miradas Económicas y Horizonte Global son las secciones que el comité
 * dictamina: sus piezas son artículos que nacen de una pieza aceptada (con
 * PDF y página propia) y se agregan con «Convertir en artículo», más abajo.
 * Las demás reciben piezas por título, que viven aparte en `edicion_piezas`
 * y sólo aparecen en la página del número.
 */

export const SECCIONES_DICTAMINADAS = new Set(["miradas-economicas", "horizonte-global"]);

export type Seccion = { id: number; nombre_display: string; slug: string; orden: number; publica: boolean };

export type Articulo = {
  id: number;
  titulo: string;
  autor: string;
  minutos_lectura: number | null;
  destacado: boolean;
  seccion_id: number;
  /** URL pública del PDF, o null si aún no tiene. */
  pdf: string | null;
  /** Por qué no tiene PDF, si no lo tiene. */
  motivo: string | null;
};

export type PiezaTitulo = { id: number; seccion_id: number; titulo: string };

export default function PiezasDelNumero({
  edicion,
  publicada,
  secciones,
  articulos,
  piezas,
}: {
  edicion: number;
  publicada: boolean;
  secciones: Seccion[];
  articulos: Articulo[];
  piezas: PiezaTitulo[];
}) {
  // "Por asignar" no es una sección de la revista; sólo se enseña si algo
  // quedó ahí, para que no desaparezca de la vista.
  const visibles = [...secciones]
    .filter((s) => s.publica || articulos.some((a) => a.seccion_id === s.id) || piezas.some((p) => p.seccion_id === s.id))
    .sort((a, b) => a.orden - b.orden);

  return (
    <div className="tarjeta">
      {visibles.map((s) => {
        const suyos = articulos.filter((a) => a.seccion_id === s.id);
        const porTitulo = piezas.filter((p) => p.seccion_id === s.id);
        const dictaminada = SECCIONES_DICTAMINADAS.has(s.slug);
        const total = suyos.length + porTitulo.length;

        return (
          <details key={s.id} className="seccion-plegable">
            <summary>
              {s.nombre_display}
              <span className="nota"> · {total === 1 ? "1 pieza" : `${total} piezas`}</span>
            </summary>

            <div className="seccion-plegable__cuerpo">
              {suyos.length > 0 && <TablaArticulos edicion={edicion} publicada={publicada} articulos={suyos} />}

              {porTitulo.length > 0 && (
                <ul className="piezas-titulo">
                  {porTitulo.map((p) => (
                    <li key={p.id}>
                      <span>{p.titulo}</span>
                      {!publicada && (
                        <Accion accion={quitarPiezaTitulo} etiqueta="Quitar">
                          <input type="hidden" name="pieza" value={p.id} />
                          <input type="hidden" name="edicion" value={edicion} />
                        </Accion>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {total === 0 && (
                <p className="nota" style={{ marginTop: 0 }}>
                  {dictaminada
                    ? "Sin piezas todavía. Se agregan con «Convertir en artículo», abajo."
                    : "Sin piezas todavía."}
                </p>
              )}

              {!dictaminada && !publicada && (
                <Accion accion={agregarPiezaTitulo} etiqueta="Agregar pieza">
                  <input type="hidden" name="edicion" value={edicion} />
                  <input type="hidden" name="seccion" value={s.id} />
                  <div className="campo">
                    <label htmlFor={`titulo-${s.id}`}>Título de la pieza</label>
                    <input id={`titulo-${s.id}`} type="text" name="titulo" maxLength={300} required />
                  </div>
                </Accion>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/**
 * Autoría, minutos y destacado se pueden ajustar también con el número ya
 * publicado: no cambian el slug ni la ruta del PDF, así que ningún enlace ni QR
 * repartido se rompe. Quitar sí deja de ofrecerse, porque borraría una página
 * pública. Los tres campos viven en celdas distintas y se suman al formulario
 * de la última con el atributo `form`.
 */
function TablaArticulos({
  edicion,
  publicada,
  articulos,
}: {
  edicion: number;
  publicada: boolean;
  articulos: Articulo[];
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Título</th>
          <th>Autoría</th>
          <th>Lectura</th>
          <th>Destacado</th>
          <th>PDF</th>
          {!publicada && <th />}
        </tr>
      </thead>
      <tbody>
        {articulos.map((a) => {
          const form = `ajuste-${a.id}`;
          return (
            <tr key={a.id}>
              <td>{a.titulo}</td>
              <td>
                <input
                  form={form}
                  type="text"
                  name="autor"
                  required
                  maxLength={300}
                  defaultValue={a.autor}
                  aria-label="Autoría"
                  style={{ minWidth: 180 }}
                />
                <span className="nota" style={{ display: "block", fontSize: 12 }}>Coautores separados por comas</span>
              </td>
              <td>
                <input
                  form={form}
                  type="number"
                  name="minutos"
                  min={1}
                  defaultValue={a.minutos_lectura ?? ""}
                  style={{ width: 78 }}
                  aria-label="Minutos de lectura"
                />
              </td>
              <td>
                <Accion id={form} accion={ajustarArticulo} etiqueta="Guardar">
                  <input type="hidden" name="articulo" value={a.id} />
                  <input type="hidden" name="edicion" value={edicion} />
                  <label style={{ textTransform: "none", letterSpacing: 0, margin: "0 0 8px", display: "flex", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" name="destacado" defaultChecked={a.destacado} style={{ width: "auto" }} />
                    Destacado
                  </label>
                </Accion>
              </td>
              <td>
                <PdfPieza articulo={a.id} url={a.pdf} motivo={a.motivo} />
              </td>
              {!publicada && (
                <td style={{ textAlign: "right" }}>
                  <Accion accion={quitarArticulo} etiqueta="Quitar">
                    <input type="hidden" name="articulo" value={a.id} />
                    <input type="hidden" name="edicion" value={edicion} />
                  </Accion>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
