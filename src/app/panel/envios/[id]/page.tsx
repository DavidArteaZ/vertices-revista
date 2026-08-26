import { notFound } from "next/navigation";
import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../../guardia";
import Accion from "../../Accion";
import { abrirArchivo, marcarAnonimizacion, vincularRevision } from "../../acciones";
import { etiquetaRol } from "@/lib/datos/portal-envios";
import Triaje from "./Triaje";
import DatosSeccion from "./DatosSeccion";
import Asignaciones from "./Asignaciones";
import Dictamenes from "./Dictamenes";
import Decision from "./Decision";

/**
 * El detalle de un envío.
 *
 * Lo que se ve de la autoría no lo decide esta página: lo decide la política
 * `autoria_lectura`, que aplica privado.puede_ver_autoria. Si la consulta no
 * devuelve fila, es que quien mira todavía está ciego, y eso se dice en voz
 * alta en vez de dejar un hueco — un campo vacío se lee como "no hay autor" y
 * lo que pasa es otra cosa.
 */

export const dynamic = "force-dynamic";

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

export default async function DetalleEnvio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quien = await exigePersonal();
  const sb = await sesion();

  const { data: envio } = await sb
    .from("envios")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!envio) notFound();

  const [
    { data: autoria },
    { data: archivos },
    { data: secciones },
    { data: temas },
    { data: tipos },
    { data: eventos },
  ] = await Promise.all([
    sb.from("envios_autoria").select("*").eq("envio_id", id).maybeSingle(),
    sb.from("envio_archivos").select("*").eq("envio_id", id).order("es_principal", { ascending: false }),
    sb.from("secciones").select("id, nombre_display, nivel, es_asignable").order("orden"),
    sb.from("temas").select("id, nombre").order("orden"),
    sb.from("tipos_pieza").select("id, nombre").order("orden"),
    sb.from("envio_eventos").select("*").eq("envio_id", id).order("at", { ascending: false }),
  ]);

  const nombreSeccion = new Map((secciones ?? []).map((s) => [s.id, s.nombre_display]));
  const declaraciones = (envio.declaraciones ?? {}) as Record<string, unknown>;

  // El original de una revisión, si el comité ya las vinculó (spec §10.1).
  const { data: original } = envio.revision_de_envio_id
    ? await sb.from("envios").select("id, folio").eq("id", envio.revision_de_envio_id).maybeSingle()
    : { data: null };

  return (
    <main className="panel-marco">
      <Cabecera quien={quien} />

      <h2>{envio.titulo}</h2>
      <p className="nota">
        <span className="folio">{envio.folio}</span> · recibido el {fechaHora(envio.created_at)}
        {original && (
          <> · revisión de <a href={`/panel/envios/${original.id}`}>{original.folio}</a></>
        )}
      </p>

      {/* ------------------------------------------------------------ autoría */}
      <h3>Autoría</h3>
      <div className="tarjeta">
        {autoria ? (
          <>
            <p style={{ margin: 0 }}>
              <strong>{autoria.nombre}</strong> — {autoria.correo}
            </p>
            {autoria.afiliacion && <p className="nota">{autoria.afiliacion}</p>}
            {autoria.coautores && <p className="nota">Coautoría: {autoria.coautores}</p>}
          </>
        ) : (
          <p className="ciego" style={{ margin: 0 }}>
            Oculta. Verás la autoría cuando envíes tu dictamen de esta pieza, o cuando
            el comité registre una decisión. No hay forma de mirarla antes, y es
            deliberado: quien necesita la identidad presenta antes su dictamen.
          </p>
        )}
      </div>

      {/* --------------------------------------------------------- manuscrito */}
      <h3>El manuscrito</h3>
      <div className="tarjeta">
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 20px", margin: 0 }}>
          <dt className="ciego">Sección</dt>
          <dd style={{ margin: 0 }}>{nombreSeccion.get(envio.seccion_id) ?? "—"}</dd>
          <dt className="ciego">Nivel</dt>
          <dd style={{ margin: 0 }}>
            {envio.nivel ? (
              <>
                {envio.nivel} · dictamina con{" "}
                {envio.seccion_dictamen_id ? nombreSeccion.get(envio.seccion_dictamen_id) : "—"}
              </>
            ) : (
              <span className="etiqueta etiqueta--alerta">Sin triar</span>
            )}
          </dd>
          <dt className="ciego">Tipo</dt>
          <dd style={{ margin: 0 }}>
            {(tipos ?? []).find((t) => t.id === envio.tipo_pieza_id)?.nombre ?? "—"}
          </dd>
          <dt className="ciego">Tema</dt>
          <dd style={{ margin: 0 }}>
            {(temas ?? []).find((t) => t.id === envio.tema_id)?.nombre ?? "—"}
          </dd>
          <dt className="ciego">Extensión</dt>
          <dd style={{ margin: 0 }}>{envio.extension ?? "—"}</dd>
          <dt className="ciego">Uso de IA</dt>
          <dd style={{ margin: 0 }}>{envio.uso_ia ?? "—"}</dd>
          <dt className="ciego">Palabras clave</dt>
          <dd style={{ margin: 0 }}>{envio.palabras_clave.join(", ") || "—"}</dd>
        </dl>
      </div>

      {/* --------------------------------------------------- contenido */}
      <DatosSeccion datosSeccion={envio.datos_seccion} resumen={envio.resumen} />

      {/* ----------------------------------------------------------- archivos */}
      <h3>Archivos</h3>
      <div className="tarjeta">
        {(archivos ?? []).length === 0 ? (
          <p className="nota">Sin archivos.</p>
        ) : (
          (archivos ?? []).map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
              <span className="folio">{a.nombre_publico}</span>
              {/* El rol es lo que distingue la cesión de derechos firmada del
                  paper: en cinco de las siete secciones ya ningún archivo se
                  marca como principal, así que el nombre público no basta. */}
              <span className="etiqueta">{etiquetaRol(a.rol)}</span>
              <span className="nota" style={{ margin: 0 }}>
                {Math.ceil(a.bytes / 1024)} KB{a.es_principal ? " · principal" : ""}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Accion accion={abrirArchivo} etiqueta="Descargar">
                  <input type="hidden" name="path" value={a.storage_path} />
                </Accion>
              </span>
            </div>
          ))
        )}
        {/* El nombre original está tras el mismo predicado que la autoría: en
            los datos reales hay un GuiaExpositor_Politica_de_Competencia.pdf. */}
        <p className="nota">
          Los nombres que ves son los que asigna la revista. El nombre con el que se
          subió el archivo se oculta igual que la autoría, y por el mismo motivo.
        </p>
      </div>

      {/* ------------------------------------------------------ declaraciones */}
      <h3>Declaraciones del autor</h3>
      <div className="tarjeta">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Trabajo original y propio: {declaraciones.d1 ? "sí" : "no"}</li>
          <li>No publicado ni en revisión en otro medio: {declaraciones.d2 ? "sí" : "no"}</li>
          <li>Acepta el proceso de dictaminación a doble ciego: {declaraciones.d3 ? "sí" : "no"}</li>
          <li>Autoriza la publicación: {declaraciones.d4 ? "sí" : "no"}</li>
        </ul>
        <p className="nota">
          Aceptadas el {fechaHora(envio.declaraciones_at)} · versión del texto{" "}
          {String(declaraciones.version ?? "—")}. La cuarta es la licencia con la que
          se puede publicar el PDF.
        </p>
      </div>

      <Triaje envio={envio} secciones={secciones ?? []} temas={temas ?? []} tipos={tipos ?? []} />

      {/* ------------------------------------------------------ anonimización */}
      <h3>Revisión de anonimización</h3>
      <div className="tarjeta">
        {envio.anonimizacion_revisada_at ? (
          <p style={{ margin: 0 }}>
            Revisada el {fechaHora(envio.anonimizacion_revisada_at)}.
            {envio.antiplagio && <> Antiplagio: {envio.antiplagio}.</>}
          </p>
        ) : (
          <>
            <p className="nota" style={{ marginTop: 0 }}>
              La revista quita los metadatos del archivo, pero no puede quitar un nombre
              impreso en la portada, en el encabezado o en los agradecimientos. Eso es
              humano y es este paso.
            </p>
            <Accion accion={marcarAnonimizacion} etiqueta="Marcar como revisada">
              <input type="hidden" name="envio" value={envio.id} />
              <div className="campo" style={{ maxWidth: 260 }}>
                <label htmlFor="antiplagio">Antiplagio</label>
                <select id="antiplagio" name="antiplagio" defaultValue="">
                  <option value="">Sin registrar</option>
                  <option value="Sí">Sí</option>
                  <option value="No">No</option>
                  <option value="N/A">N/A</option>
                </select>
              </div>
            </Accion>
          </>
        )}
      </div>

      <Asignaciones envio={envio} quien={quien} />
      <Dictamenes envio={envio} quien={quien} />
      <Decision envio={envio} />

      {/* -------------------------------------------------------- revisiones */}
      {!envio.revision_de_envio_id && (
        <>
          <h3>¿Es la revisión de un envío anterior?</h3>
          <div className="tarjeta">
            <p className="nota" style={{ marginTop: 0 }}>
              Sin cuentas de autor, quien rehace su pieza vuelve por el formulario
              público y recibe un folio nuevo. Vincularlos aquí es lo que deja seguir
              la historia de dictamen.
            </p>
            <Accion accion={vincularRevision} etiqueta="Vincular">
              <input type="hidden" name="envio" value={envio.id} />
              <div className="campo" style={{ maxWidth: 240 }}>
                <label htmlFor="original">Folio del envío original</label>
                <input type="text" id="original" name="original" placeholder="VTX-2026-001" />
              </div>
            </Accion>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------- bitácora */}
      <h3>Bitácora</h3>
      <div className="tarjeta">
        {(eventos ?? []).length === 0 ? (
          <p className="nota">Sin movimientos.</p>
        ) : (
          <table>
            <tbody>
              {(eventos ?? []).map((ev) => (
                <tr key={ev.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fechaHora(ev.at)}</td>
                  <td>{ev.tipo.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="nota">
          Sólo se añade: nadie tiene permiso para corregir ni borrar esta tabla. Es lo
          que sostiene que la ceguera sea responsable aunque no sea absoluta.
        </p>
      </div>
    </main>
  );
}
