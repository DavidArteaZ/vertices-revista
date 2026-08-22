import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "./guardia";

/**
 * La cola (spec §16, etapa 5).
 *
 * Ninguna columna de aquí sale de envios_autoria, y no por disciplina de quien
 * escribió la consulta: `envios` no lleva PII, así que la cola hereda la
 * ceguera sin lógica propia (spec §7.2). Es la razón de partir la tabla en dos.
 *
 * Todo se lee con la sesión de la persona, de modo que si RLS estuviera mal la
 * pantalla saldría vacía, no de más.
 */

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  recibido:    { texto: "Recibido",    clase: "etiqueta--pendiente" },
  triage:      { texto: "En triaje",   clase: "etiqueta--pendiente" },
  asignado:    { texto: "Asignado",    clase: "etiqueta--curso" },
  en_dictamen: { texto: "En dictamen", clase: "etiqueta--curso" },
  decidido:    { texto: "Decidido",    clase: "etiqueta--lista" },
};

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

export default async function Cola() {
  const quien = await exigePersonal();
  const sb = await sesion();

  const [{ data: envios }, { data: asignaciones }, { data: dictamenes }] = await Promise.all([
    sb
      .from("envios")
      .select("id, folio, titulo, estado, nivel, created_at, seccion_id, decision_id")
      .is("archivado_at", null)
      .order("created_at", { ascending: false }),
    sb.from("asignaciones").select("envio_id, revisor_id"),
    sb.from("dictamenes").select("envio_id, revisor_id, estado"),
  ]);

  const { data: secciones } = await sb.from("secciones").select("id, nombre_display");
  const nombreSeccion = new Map((secciones ?? []).map((s) => [s.id, s.nombre_display]));

  const lista = envios ?? [];
  const porEnvio = (id: string) => (asignaciones ?? []).filter((a) => a.envio_id === id);
  const enviadosDe = (id: string) =>
    (dictamenes ?? []).filter((d) => d.envio_id === id && d.estado === "enviado").length;

  // Lo que el comité necesita ver de un vistazo, que es lo que hoy nadie ve:
  // qué lleva sin asignar y qué lleva asignado sin dictaminar.
  const sinTriaje = lista.filter((e) => !e.nivel).length;
  const sinAsignar = lista.filter((e) => e.nivel && porEnvio(e.id).length === 0).length;
  const enCurso = lista.filter((e) => porEnvio(e.id).length > 0 && !e.decision_id).length;
  const decididos = lista.filter((e) => e.decision_id).length;

  // Lo mío: dónde estoy asignada y todavía no he enviado dictamen.
  const mios = lista.filter(
    (e) =>
      porEnvio(e.id).some((a) => a.revisor_id === quien.id) &&
      !(dictamenes ?? []).some(
        (d) => d.envio_id === e.id && d.revisor_id === quien.id && d.estado === "enviado",
      ),
  );

  return (
    <main className="panel-marco">
      <Cabecera quien={quien} />

      <div className="cifras">
        <div className="cifra"><b>{sinTriaje}</b><span>Por asignar</span></div>
        <div className="cifra"><b>{sinAsignar}</b><span>Sin dictaminador</span></div>
        <div className="cifra"><b>{enCurso}</b><span>En curso</span></div>
        <div className="cifra"><b>{decididos}</b><span>Decididos</span></div>
        <div className="cifra"><b>{mios.length}</b><span>Me tocan</span></div>
      </div>

      {mios.length > 0 && (
        <>
          <h3>Pendientes de tu dictamen</h3>
          <div className="tarjeta">
            <Tabla filas={mios} nombreSeccion={nombreSeccion} porEnvio={porEnvio} enviadosDe={enviadosDe} />
          </div>
        </>
      )}

      <h3>Todos los envíos</h3>
      <div className="tarjeta">
        {lista.length === 0 ? (
          <p className="nota">Todavía no hay envíos.</p>
        ) : (
          <Tabla filas={lista} nombreSeccion={nombreSeccion} porEnvio={porEnvio} enviadosDe={enviadosDe} />
        )}
      </div>
    </main>
  );
}

type Fila = {
  id: string;
  folio: string;
  titulo: string;
  estado: string;
  nivel: string | null;
  created_at: string;
  seccion_id: number;
  decision_id: number | null;
};

function Tabla({
  filas,
  nombreSeccion,
  porEnvio,
  enviadosDe,
}: {
  filas: Fila[];
  nombreSeccion: Map<number, string>;
  porEnvio: (id: string) => { revisor_id: string }[];
  enviadosDe: (id: string) => number;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Folio</th>
          <th>Título</th>
          <th>Sección</th>
          <th>Nivel</th>
          <th>Dictámenes</th>
          <th>Estado</th>
          <th>Recibido</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((e) => {
          const estado = ETIQUETA_ESTADO[e.estado] ?? { texto: e.estado, clase: "" };
          const asignados = porEnvio(e.id).length;
          return (
            <tr key={e.id}>
              <td className="folio">
                <a href={`/panel/envios/${e.id}`}>{e.folio}</a>
              </td>
              <td>{e.titulo}</td>
              <td>{nombreSeccion.get(e.seccion_id) ?? "—"}</td>
              <td>
                {e.nivel ?? <span className="etiqueta etiqueta--alerta">Sin triar</span>}
              </td>
              <td>
                {asignados === 0 ? (
                  <span className="ciego">sin asignar</span>
                ) : (
                  `${enviadosDe(e.id)} de ${asignados}`
                )}
              </td>
              <td>
                <span className={`etiqueta ${estado.clase}`}>{estado.texto}</span>
              </td>
              <td>{fecha(e.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
