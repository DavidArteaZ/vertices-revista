import Link from "next/link";
import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../guardia";
import Accion from "../Accion";
import { crearEdicion } from "./acciones";

/**
 * Los números de la revista (spec §9.1).
 *
 * Un número nace en borrador y así se queda hasta que alguien lo publica. Ese
 * estado es el que decide qué ve el público: la política de `articulos` mira
 * la edición de cada pieza, así que mientras el número esté en borrador sus
 * artículos no existen para nadie de fuera, aunque se adivine el slug.
 */

export const dynamic = "force-dynamic";

export default async function Ediciones() {
  const quien = await exigePersonal();
  const sb = await sesion();

  const [{ data: ediciones }, { data: articulos }] = await Promise.all([
    sb.from("ediciones").select("*").order("numero", { ascending: false }),
    sb.from("articulos").select("id, edicion_id").not("edicion_id", "is", null),
  ]);

  const piezas = (id: number) => (articulos ?? []).filter((a) => a.edicion_id === id).length;

  return (
    <main className="panel-marco">
      <Cabecera quien={quien} />

      <h2>Números</h2>
      <p className="nota">
        Al publicar, los artículos de este número se harán públicos.
      </p>

      <h3>Publicados y en preparación</h3>
      <div className="tarjeta">
        {(ediciones ?? []).length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Todavía no hay ningún número.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Título</th>
                <th>Piezas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(ediciones ?? []).map((e) => (
                <tr key={e.id} className="fila-enlace">
                  <td className="folio">
                    <Link href={`/panel/ediciones/${e.id}`}>{e.numero}</Link>
                  </td>
                  <td>{e.titulo}</td>
                  <td>{piezas(e.id)}</td>
                  <td>
                    <span
                      className={`etiqueta ${
                        e.estado === "publicada" ? "etiqueta--lista" : "etiqueta--pendiente"
                      }`}
                    >
                      {e.estado === "publicada" ? "Publicada" : "Borrador"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h3>Nuevo número</h3>
      <div className="tarjeta">
        <Accion accion={crearEdicion} etiqueta="Crear" lleno>
          <div className="fila">
            <div className="campo" style={{ maxWidth: 120, flex: "0 0 120px" }}>
              <label htmlFor="numero">Número</label>
              <input type="number" id="numero" name="numero" min={1} />
            </div>
            <div className="campo">
              <label htmlFor="titulo">Título del número</label>
              <input type="text" id="titulo" name="titulo" />
            </div>
          </div>
        </Accion>
      </div>
    </main>
  );
}
