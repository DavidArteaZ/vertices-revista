import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../../guardia";
import Accion from "../../Accion";
import Invitados from "./Invitados";
import PdfPieza from "./PdfPieza";
import { copiarManuscrito, motivoSinPdf, urlPublica } from "../pdf";
import {
  adjuntar,
  ajustarArticulo,
  guardarParametros,
  quitarArticulo,
  publicar,
} from "../acciones";

/**
 * Armar un número: definir sus parámetros, convertir piezas aceptadas en
 * artículos (lo que ya copia su PDF y le da enlace), ajustarlas y publicar el
 * número (spec §9.2, §9.3).
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

  const [{ data: articulos }, { data: secciones }, { data: candidatos }, registros] = await Promise.all([
    sb
      .from("articulos")
      .select("id, titulo, autor, slug, minutos_lectura, destacado, pdf_publico_path, seccion_id, envio_id")
      .eq("edicion_id", edicionId)
      .order("id"),
    sb.from("secciones").select("id, nombre_display"),
    sb
      .from("envios")
      .select("id, folio, titulo, decision_id, edicion_id")
      .not("decision_id", "is", null)
      .is("archivado_at", null),
    sb
      .from("registros_evento")
      .select("id, nombre, correo, perfil, invitado, created_at")
      .eq("edicion_id", edicionId)
      .order("created_at"),
  ]);

  if (registros.error) {
    console.error(JSON.stringify({ evento: "panel_invitados_fallo", edicion: edicionId, error: registros.error.message }));
  }

  // El formato del manuscrito principal explica por qué una pieza sigue sin PDF.
  const envioIds = (articulos ?? []).flatMap((a) => (a.envio_id ? [a.envio_id] : []));
  const { data: principales } = envioIds.length
    ? await sb.from("envio_archivos").select("envio_id, mime").in("envio_id", envioIds).eq("es_principal", true)
    : { data: [] };
  const mimePrincipal = new Map((principales ?? []).map((p) => [p.envio_id, p.mime]));

  // Las piezas convertidas antes de que la copia ocurriera al convertir llegan
  // aquí sin PDF aunque su manuscrito sí lo sea. Se copian al abrir el número
  // para que el comité no tenga que volver a subir lo que el autor ya mandó.
  const fallosCopia = new Map<number, string>();
  for (const a of articulos ?? []) {
    if (a.pdf_publico_path || !a.envio_id || motivoSinPdf(mimePrincipal.get(a.envio_id))) continue;
    const copia = await copiarManuscrito(sb, a, edicionId);
    if ("ruta" in copia) a.pdf_publico_path = copia.ruta;
    else fallosCopia.set(a.id, copia.motivo);
  }

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
              <label htmlFor="hora_evento">Hora de evento</label>
              <input
                id="hora_evento"
                type="time"
                name="hora_evento"
                defaultValue={edicion.hora_evento?.slice(0, 5) ?? ""}
              />
              {!edicion.hora_evento && <p className="nota">por decidir</p>}
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

      <Invitados edicion={edicionId} numero={edicion.numero} registros={registros.data ?? []} error={Boolean(registros.error)} />

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
                    <PdfPieza
                      articulo={a.id}
                      url={a.pdf_publico_path ? urlPublica(a.pdf_publico_path) : null}
                      motivo={(a.envio_id ? motivoSinPdf(mimePrincipal.get(a.envio_id)) : null) ?? fallosCopia.get(a.id) ?? null}
                    />
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
              Enciende el número entero de una vez: sus artículos aparecen en el sitio
              con el enlace a su PDF. Cada pieza necesita su PDF antes; las que se
              enviaron en Word, su versión maquetada subida en su fila.
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
