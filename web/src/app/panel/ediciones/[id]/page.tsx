import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../../guardia";
import Accion from "../../Accion";
import { adjuntar, ajustarArticulo, quitarArticulo, publicar } from "../acciones";

/**
 * Armar un número: colgarle piezas, ajustarlas y publicarlo (spec §9.2, §9.3).
 *
 * El selector de piezas sólo ofrece envíos con decisión ACEPTANTE. No es
 * cortesía de la interfaz: adjuntar_articulo lo vuelve a comprobar y falla si
 * no, porque un «requiere reelaboración» colgado de una edición convertiría un
 * veredicto en una publicación por descuido.
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
    // Aceptadas y todavía sin artículo: lo que se puede colgar de un número.
    sb
      .from("envios")
      .select("id, folio, titulo, decision_id, decisiones(es_aceptante)")
      .not("decision_id", "is", null)
      .is("archivado_at", null),
  ]);

  const nombreSeccion = new Map((secciones ?? []).map((s) => [s.id, s.nombre_display]));

  // Relationships está vacío en los tipos generados, así que el join anidado no
  // se puede usar: las decisiones aceptantes se resuelven en una consulta
  // aparte, que además es más barata.
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
    (e) => e.decision_id && idsAceptantes.has(e.decision_id) && !yaTienen.has(e.id),
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

      <h3>Piezas del número</h3>
      <div className="tarjeta">
        {(articulos ?? []).length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Todavía no hay piezas.</p>
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
          <h3>Añadir una pieza aceptada</h3>
          <div className="tarjeta">
            {disponibles.length === 0 ? (
              <p className="nota" style={{ marginTop: 0 }}>
                No hay piezas aceptadas sin número. Sólo se puede publicar lo que el
                comité aceptó.
              </p>
            ) : (
              <Accion accion={adjuntar} etiqueta="Añadir al número">
                <input type="hidden" name="edicion" value={edicionId} />
                <div className="fila">
                  <div className="campo">
                    <label htmlFor="envio">Pieza</label>
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
              Copia el PDF de cada pieza del bucket privado al público y enciende el
              número entero de una vez. Sólo se copian PDF: una pieza enviada en Word
              necesita su versión maquetada antes.
            </p>
            <Accion
              accion={publicar}
              etiqueta="Publicar el número"
              lleno
              confirmar="Publicar deja las piezas y sus PDF accesibles a cualquiera. ¿Continuar?"
            >
              <input type="hidden" name="edicion" value={edicionId} />
            </Accion>
          </div>
        </>
      )}
    </main>
  );
}
