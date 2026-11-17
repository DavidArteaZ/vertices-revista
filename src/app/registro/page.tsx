import Image from "next/image";
import { servidor } from "@/lib/supabase/servidor";
import { ordinalEdicionEs } from "@/lib/decisiones-finales";
import { fechaEvento, horaEvento, personasRegistradas, ubicacionEvento } from "@/lib/evento";
import FormularioRegistro from "./FormularioRegistro";
import "./registro.css";

export const dynamic = "force-dynamic";

export default async function Registro() {
  const sb = servidor();
  const { data: edicion } = await sb
    .from("ediciones")
    .select("id, numero, fecha_lanzamiento, hora_evento, ubicacion_evento_lanzamiento, cupo_invitados")
    .eq("activa", true)
    .maybeSingle();

  // Sin cupo guardado no hay nada que contar. Si el conteo falla, el formulario
  // sigue abierto: /api/registro vuelve a comprobar el cupo antes de guardar.
  let agotado = false;
  if (edicion?.cupo_invitados) {
    const { data: registros, error } = await sb
      .from("registros_evento")
      .select("invitado")
      .eq("edicion_id", edicion.id);
    if (error) console.error(JSON.stringify({ evento: "registro_cupo_fallo", error: error.message }));
    else agotado = personasRegistradas(registros) >= edicion.cupo_invitados;
  }

  const hora = horaEvento(edicion?.hora_evento ?? null);

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
            <h1>{agotado ? "Lugares agotados" : "Registro para el evento de lanzamiento"}</h1>

            {edicion && agotado ? (
              <p className="registro-subtitulo">
                Gracias por tu interés en Vértices. Los lugares para el lanzamiento de la{" "}
                <strong>{ordinalEdicionEs(edicion.numero)} edición</strong> se han agotado, pero esperamos verte en el
                siguiente.
              </p>
            ) : edicion ? (
              <p className="registro-subtitulo">
                El próximo <strong>{fechaEvento(edicion.fecha_lanzamiento)}</strong>
                {hora && <> {hora.startsWith("1:") ? "a la" : "a las"} <strong>{hora}</strong></>} en{" "}
                <strong>{ubicacionEvento(edicion.ubicacion_evento_lanzamiento)}</strong>{" "}
                se celebrará el lanzamiento de la <strong>{ordinalEdicionEs(edicion.numero)} edición</strong> de Vértices!
              </p>
            ) : (
              <p className="registro-subtitulo">
                Próximamente publicaremos los detalles del siguiente evento de lanzamiento.
              </p>
            )}
          </div>

          <div className="registro-fila">
            <div className="registro-tarjeta">
              <p className="registro-ceja">{agotado ? "Cupo completo" : "Confirma tu asistencia"}</p>
              <h2>{agotado ? "Registro cerrado" : "Registro"}</h2>
              {agotado ? (
                <p className="registro-aviso">
                  Si ya te registraste, tu lugar sigue confirmado. Encontrarás los detalles en el correo de
                  confirmación que te enviamos.
                </p>
              ) : edicion ? (
                <FormularioRegistro />
              ) : (
                <p className="registro-aviso">
                  El registro todavía no está disponible porque no hay una edición activa.
                </p>
              )}
            </div>

            <div className="registro-mascota">
              <Image
                src="/registro/piberto.webp"
                alt="Piberto, la mascota de Vértices, leyendo un libro"
                width={640}
                height={640}
                sizes="(max-width: 900px) 74vw, 320px"
                priority
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
