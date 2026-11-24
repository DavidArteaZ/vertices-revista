import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../../guardia";
import Accion from "../../Accion";
import Invitados from "./Invitados";
import PiezasDelNumero from "./PiezasDelNumero";
import PdfEdicion from "./PdfEdicion";
import CarruselEdicion from "./CarruselEdicion";
import { copiarManuscrito, motivoSinPdf, urlPublica } from "../pdf";
import {
  adjuntar,
  guardarParametros,
  publicar,
} from "../acciones";

/**
 * Armar un número: definir sus parámetros, convertir piezas aceptadas en
 * artículos (lo que ya copia su PDF y le da enlace), ajustarlas y publicar el
 * número (spec §9.2, §9.3).
 *
 * Aceptar una pieza NO crea un artículo. El selector de abajo es el paso
 * editorial explícito que hace esa conversión y `adjuntar_articulo` vuelve a
 * comprobar en base que la decisión técnica sea aceptante, o que el comité
 * haya autorizado la pieza por excepción.
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

  const [{ data: articulos }, { data: secciones }, { data: candidatos }, registros, { data: piezasTitulo }] = await Promise.all([
    sb
      .from("articulos")
      .select("id, titulo, autor, slug, minutos_lectura, destacado, pdf_publico_path, seccion_id, envio_id")
      .eq("edicion_id", edicionId)
      .order("id"),
    sb.from("secciones").select("id, nombre_display, slug, orden, publica"),
    sb
      .from("envios")
      .select("id, folio, titulo, decision_id, edicion_id, excepcion_publicacion")
      .not("decision_id", "is", null)
      .is("archivado_at", null),
    sb
      .from("registros_evento")
      .select("id, nombre, correo, perfil, invitado, created_at")
      .eq("edicion_id", edicionId)
      .order("created_at"),
    sb.from("edicion_piezas").select("id, seccion_id, titulo").eq("edicion_id", edicionId).order("id"),
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
      (idsAceptantes.has(e.decision_id) || e.excepcion_publicacion !== null) &&
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
            <div className="campo">
              <label htmlFor="cupo_invitados">Cantidad de invitados</label>
              <input
                id="cupo_invitados"
                type="number"
                name="cupo_invitados"
                min={1}
                step={1}
                placeholder="sin límite"
                defaultValue={edicion.cupo_invitados ?? ""}
              />
              <p className="nota">
                {edicion.cupo_invitados ? "al llenarse, /registro se cierra" : "sin límite"}
              </p>
            </div>
          </div>
          <p className="nota" style={{ marginBottom: 14 }}>
            Los campos sin definir se comunican como «por decidir»; las fechas se guardan como fecha y los correos las escriben en palabras.
          </p>
        </Accion>
      </div>

      <Invitados edicion={edicionId} numero={edicion.numero} cupo={edicion.cupo_invitados} registros={registros.data ?? []} error={Boolean(registros.error)} />

      <h3>Piezas del número</h3>
      <PiezasDelNumero
        edicion={edicionId}
        publicada={publicada}
        secciones={secciones ?? []}
        piezas={piezasTitulo ?? []}
        articulos={(articulos ?? []).map((a) => ({
          ...a,
          pdf: a.pdf_publico_path ? urlPublica(a.pdf_publico_path) : null,
          motivo: (a.envio_id ? motivoSinPdf(mimePrincipal.get(a.envio_id)) : null) ?? fallosCopia.get(a.id) ?? null,
        }))}
      />

      <h3>PDF Edición Final</h3>
      <div className="tarjeta">
        <PdfEdicion
          edicion={edicionId}
          url={edicion.pdf_final_path ? urlPublica(edicion.pdf_final_path) : null}
          enlacePublico={publicada ? `/ediciones/${edicion.numero}` : null}
        />
      </div>

      <h3>Edición en la portada</h3>
      <div className="tarjeta">
        <CarruselEdicion
          edicion={edicionId}
          encendido={edicion.portada_en_carrusel}
          primero={edicion.portada_edicion_primero}
          activa={edicion.activa}
          publicada={publicada}
          imagenes={{
            portada: edicion.carrusel_portada_path ? urlPublica(edicion.carrusel_portada_path) : null,
            "pliego-izq": edicion.carrusel_pliego_izq_path ? urlPublica(edicion.carrusel_pliego_izq_path) : null,
            "pliego-der": edicion.carrusel_pliego_der_path ? urlPublica(edicion.carrusel_pliego_der_path) : null,
          }}
        />
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
                          {e.excepcion_publicacion !== null && " · por excepción"}
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
              con el enlace a su PDF y el número completo queda en /ediciones/{edicion.numero}.
              Cada pieza necesita su PDF antes (las que se enviaron en Word, su versión
              maquetada subida en su fila) y el número necesita su PDF de edición final.
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
