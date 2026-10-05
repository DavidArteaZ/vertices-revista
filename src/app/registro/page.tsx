import { servidor } from "@/lib/supabase/servidor";
import { ordinalEdicionEs } from "@/lib/decisiones-finales";
import FormularioRegistro from "./FormularioRegistro";
import "./registro.css";

export const dynamic = "force-dynamic";

function fechaLarga(fecha: string | null) {
  if (!fecha) return "fecha por definir";
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(anio, mes - 1, dia, 12)));
}

export default async function Registro() {
  const sb = servidor();
  const { data: edicion } = await sb
    .from("ediciones")
    .select("id, numero, fecha_lanzamiento, ubicacion_evento_lanzamiento")
    .eq("activa", true)
    .maybeSingle();

  return (
    <main className="registro-lienzo">
      <div className="registro-grano" aria-hidden="true" />
      <section className="registro-contenido">
        <header className="registro-cabecera">
          <a className="registro-marca" href="/" aria-label="Volver a Vértices">
            Vértices
          </a>
          <p>Revista Estudiantil de Economía</p>
        </header>

        <div className="registro-grid">
          <div className="registro-presentacion">
            <p className="registro-ceja">Vértices · Evento</p>
            <h1>Registro para el evento de lanzamiento</h1>
          </div>


          <div className="registro-fila">
            <div className="registro-tarjeta">
              <p className="registro-ceja">Confirma tu asistencia</p>
              <h2>Registro</h2>
              {edicion ? (
                <FormularioRegistro />
              ) : (
                <p className="registro-aviso">
                  El registro todavía no está disponible porque no hay una edición activa.
                </p>
              )}
            </div>

            <div className="registro-mascota" aria-label="Espacio reservado para la mascota de Vértices">
              <span>Imagen de mascota<br />320 × 320 px</span>
            </div>
          </div>

          {edicion ? (
            <p className="registro-subtitulo">
              El próximo <strong>{fechaLarga(edicion.fecha_lanzamiento)}</strong> en{" "}
              <strong>{edicion.ubicacion_evento_lanzamiento?.trim() || "ubicación por definir"}</strong>{" "}
              se celebrará el lanzamiento de la <strong>{ordinalEdicionEs(edicion.numero)} edición</strong> de Vértices!
            </p>
          ) : (
            <p className="registro-subtitulo">
              Próximamente publicaremos los detalles del siguiente evento de lanzamiento.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
