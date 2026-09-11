import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../../guardia";
import Accion from "../../Accion";
import {
  adjuntar,
  ajustarArticulo,
  guardarParametros,
  quitarArticulo,
  publicar,
} from "../acciones";

/**
 * Armar un número: definir sus parámetros, convertir piezas aceptadas en
 * artículos, ajustarlas y publicar el número (spec §9.2, §9.3).
 *
 * Aceptar una pieza NO crea un artículo. El selector de abajo es el paso
 * editorial explícito que hace esa conversión y `adjuntar_articulo` vuelve a
 * comprobar en base que la decisión técnica sea aceptante.
 */

export const dynamic = "force-dynamic";

export default async function DetalleEdicion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const edicionId = Number(id);
  const quien = await exigePersonal();
  const sb = await sesion();

  const { data: edicion } = await sb
    .from("ediciones")
    .select("*")
    .eq("id", edicionId)
    .maybeSingle();

  if (!edicion) notFound();

  const publicada = edicion.estado === "publicada";

  const [{ data: articulos }, { data: secciones }, { data: candidatos }] = await Promise.all([
    sb
      .from("articulos")
      .select("id, titulo, autor, slug, minutos_lectura, destacado, pdf_publico_path, seccion_id")
      .eq("edicion_id", edicionId)
      .order("id"),
    sb.from("secciones").select("id, nombre_display"),
    sb
      .from("envios")
      .select("id, folio, titulo, decision_id, edicion_id")
      .not("decision_id", "is", null)
      .is("archivado_at", null),
  ]);

  const nombreSeccion = new Map((secciones ?? []).map((s) => [s.id, s.nombre_display]));

  const { data: aceptantes } = await sb
    .from("decisiones")
    .select("id")
    .eq("es_aceptante", true);
  const idsAceptantes = new Set((aceptantes ?? []).map((d) => d.id));

  const { data: yaPublicados } = await sb
    .from("articulos")
    .select("envio_id")
    .not("envio_id", "is", null);
  const yaTienen = new Set((yaPublicados ?? []).map((a) => a.envio_id));

  const disponibles = (candidatos ?? []).filter(
    (e) =>
      e.decision_id &&
      idsAceptantes.has(e.decision_id) &&
      !yaTienen.has(e.id) &&
      (e.edicion_id === edicionId || e.edicion_id === null),
  );

  return (
    <main className="panel-marco">
      <Cabecera quien={quien} />

      <h2>
        Número {edicion.numero} · {edicion.titulo}
      </h2>
      <p className="nota">
        <span className={`etiqueta ${publicada ? "etiqueta--lista" : "etiqueta--pendiente"}`}>
          {publicada ? "Publicada" : "Borrador"}
        </span>
        {publicada && edicion.publicada_at && (
          <> el {new Date(edicion.publicada_at).toLocaleDateString("es-MX", { dateStyle: "long" })}</>
        )}
      </p>

      <h3>Parámetros</h3>
      <div className="tarjeta">
        <Accion accion={guardarParametros} etiqueta="Guardar parámetros">
          <input type="hidden" name="edicion" value={edicionId} />
          <div className="fila">
            <div className="campo">
              <label htmlFor="fecha_lanzamiento">Fecha de lanzamiento</label>
              <input
                id="fecha_lanzamiento"
                type="date"
                name="fecha_lanzamiento"
                defaultValue={edicion.fecha_lanzamiento ?? ""}
              />
              {!edicion.fecha_lanzamiento && <p className="nota">por decidir</p>}
            </div>
            <div className="campo">
              <label htmlFor="ubicacion_evento_lanzamiento">Ubicación evento lanzamiento</label>
              <input
                id="ubicacion_evento_lanzamiento"
                type="text"
                name="ubicacion_evento_lanzamiento"
                placeholder="por decidir"
                defaultValue={edicion.ubicacion_evento_lanzamiento ?? ""}
              />
            </div>
            <div className="campo">
              <label htmlFor="fecha_limite_revisiones">Fecha límite para revisiones</label>
              <input
                id="fecha_limite_revisiones"
                type="date"
                name="fecha_limite_revisiones"
                defaultValue={edicion.fecha_limite_revisiones ?? ""}
              />
              {!edicion.fecha_limite_revisiones && <p className="nota">por decidir</p>}
            </div>
          </div>
          <p className="nota" style={{ marginBottom: 14 }}>
            Los campos sin definir se comunican como «por decidir»; las fechas se guardan como fecha y los correos las escriben en palabras.
          </p>
        </Accion>
      </div>

      <h3>Piezas del número</h3>
      <div className="tarjeta">
        {(articulos ?? []).length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Todavía no hay piezas convertidas en artículos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Autoría</th>
                <th>Sección</th>
                <th>Lectura</th>
                <th>Destacado</th>
                <th>PDF</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(articulos ?? []).map((a) => (
                <tr key={a.id}>
                  <td>{a.titulo}</td>
                  <td>{a.autor}</td>
                  <td>{nombreSeccion.get(a.seccion_id) ?? "—"}</td>
                  <td colSpan={publicada ? 1 : 2}>
                    {publicada ? (
                      <>
                        {a.minutos_lectura ?? "—"} min{a.destacado ? " · destacado" : ""}
                      </>
                    ) : (
                      <Accion accion={ajustarArticulo} etiqueta="Guardar">
                        <input type="hidden" name="articulo" value={a.id} />
                        <input type="hidden" name="edicion" value={edicionId} />
                        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                          <input
                            type="number"
                            name="minutos"
                            min={1}
                            defaultValue={a.minutos_lectura ?? ""}
                            style={{ width: 78 }}
                            aria-label="Minutos de lectura"
                          />
                          <label style={{ textTransform: "none", letterSpacing: 0, margin: 0, display: "flex", gap: 6, fontSize: 13 }}>
                            <input
                              type="checkbox"
                              name="destacado"
                              defaultChecked={a.destacado}
                              style={{ width: "auto" }}
                            />
                            Destacado
                          </label>
                        </div>
                      </Accion>
                    )}
                  </td>
                  <td>
                    {a.pdf_publico_path ? (
                      <span className="etiqueta etiqueta--lista">Copiado</span>
                    ) : (
                      <span className="ciego">al publicar</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {!publicada && (
                      <Accion accion={quitarArticulo} etiqueta="Quitar">
                        <input type="hidden" name="articulo" value={a.id} />
                        <input type="hidden" name="edicion" value={edicionId} />
                      </Accion>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!publicada && (
        <>
          <h3>Convertir una pieza aceptada en artículo</h3>
          <div className="tarjeta">
            {disponibles.length === 0 ? (
              <p className="nota" style={{ marginTop: 0 }}>
                No hay piezas aceptadas pendientes de convertir en artículo.
              </p>
            ) : (
              <Accion accion={adjuntar} etiqueta="Convertir en artículo">
                <input type="hidden" name="edicion" value={edicionId} />
                <div className="fila">
                  <div className="campo">
                    <label htmlFor="envio">Pieza aceptada</label>
                    <select id="envio" name="envio" defaultValue="">
                      <option value="">Elige una</option>
                      {disponibles.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.folio} · {e.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="campo" style={{ maxWidth: 150, flex: "0 0 150px" }}>
                    <label htmlFor="minutos">Minutos de lectura</label>
                    <input type="number" id="minutos" name="minutos" min={1} />
                  </div>
                </div>
              </Accion>
            )}
          </div>

          <h3>Publicar</h3>
          <div className="tarjeta">
            <p className="nota" style={{ marginTop: 0 }}>
              Copia el PDF de cada artículo del bucket privado al público y enciende el
              número entero de una vez. Sólo se copian PDF: una pieza enviada en Word
              necesita su versión maquetada antes.
            </p>
            <Accion
              accion={publicar}
              etiqueta="Publicar el número"
              lleno
              confirmar="Publicar deja los artículos y sus PDF accesibles a cualquiera. ¿Continuar?"
            >
              <input type="hidden" name="edicion" value={edicionId} />
            </Accion>
          </div>
        </>
      )}
    </main>
  );
}
