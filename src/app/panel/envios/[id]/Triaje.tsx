import Accion from "../../Accion";
import { triar } from "../../acciones";
import type { Tabla } from "@/lib/supabase/tipos";

/**
 * Triaje: darle sección de verdad a una pieza que llegó como "Por asignar".
 *
 * El formulario no ofrece nivel ni instrumento de dictamen, y no es un olvido.
 * Los deriva el disparador envios_deriva_enrutamiento a partir de la sección y
 * el tipo, con la excepción del libro incluida —Horizonte Global con
 * investigación sube a Nivel A y se dictamina con Miradas Económicas—. Dejar
 * elegir el instrumento a mano sería dejar elegir qué tan exigente es la
 * rúbrica con esta pieza en concreto.
 */
export default function Triaje({
  envio,
  secciones,
  temas,
  tipos,
}: {
  envio: Tabla<"envios">;
  secciones: { id: number; nombre_display: string; nivel: string | null; es_asignable: boolean }[];
  temas: { id: number; nombre: string }[];
  tipos: { id: number; nombre: string }[];
}) {
  const sinTriar = !envio.nivel;

  return (
    <>
      <h3>{sinTriar ? "Triaje pendiente" : "Corregir la clasificación"}</h3>
      <div className="tarjeta">
        {sinTriar && (
          <p className="nota" style={{ marginTop: 0 }}>
            El autor no eligió sección, o eligió «Aún no lo decido». Sin sección no hay
            nivel, y sin nivel no se puede asignar a nadie: no habría instrumento con
            el que dictaminar.
          </p>
        )}

        <Accion accion={triar} etiqueta="Guardar clasificación" lleno={sinTriar}>
          <input type="hidden" name="envio" value={envio.id} />
          <div className="fila">
            <div className="campo">
              <label htmlFor="seccion">Sección</label>
              <select id="seccion" name="seccion" defaultValue={String(envio.seccion_id)}>
                {secciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre_display}
                    {s.nivel ? ` · Nivel ${s.nivel}` : " · sin nivel"}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="tipo">Tipo de pieza</label>
              <select id="tipo" name="tipo" defaultValue={String(envio.tipo_pieza_id ?? "")}>
                <option value="">Sin definir</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="fila">
            <div className="campo">
              <label htmlFor="tema">Tema</label>
              <select id="tema" name="tema" defaultValue={String(envio.tema_id ?? "")}>
                <option value="">Sin definir</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="extension">Extensión</label>
              <input
                type="text"
                id="extension"
                name="extension"
                defaultValue={envio.extension ?? ""}
                placeholder="600 palabras, 5 cuartillas…"
              />
            </div>
          </div>
        </Accion>
      </div>
    </>
  );
}
