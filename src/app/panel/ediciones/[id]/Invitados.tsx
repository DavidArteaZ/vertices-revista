import BorrarRegistro from "./BorrarRegistro";
import DescargarCsv from "./DescargarCsv";

type Registro = {
  id: number;
  nombre: string;
  correo: string;
  perfil: string;
  invitado: boolean;
  created_at: string;
};

export type Invitado = Omit<Registro, "created_at"> & { registrado: string };

// Hora de la Ciudad de México: la base guarda UTC y el comité lee hora local.
const formatoRegistro = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/**
 * Quiénes se registraron en /registro para el evento de este número. El
 * contador es de personas, no de registros: quien lleva +1 cuenta por dos.
 */
export default function Invitados({
  edicion,
  numero,
  registros: filas,
  error,
}: {
  edicion: number;
  numero: number;
  registros: Registro[];
  error: boolean;
}) {
  const registros: Invitado[] = filas.map(({ created_at, ...r }) => ({
    ...r,
    registrado: formatoRegistro.format(new Date(created_at)),
  }));
  const personas = registros.reduce((total, r) => total + (r.invitado ? 2 : 1), 0);

  return (
    <>
      <h3 style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span>Invitados</span>
        <span aria-label={`${personas} personas`} style={{ font: "600 20px var(--f-ui)", letterSpacing: 0, color: "var(--tinta)" }}>
          {personas}
        </span>
      </h3>
      <div className="tarjeta">
        {error ? (
          <p className="nota" style={{ marginTop: 0 }}>No se pudieron cargar los registros. Recarga la página.</p>
        ) : registros.length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Todavía nadie se ha registrado al evento de este número.</p>
        ) : (
          <details>
            <summary className="boton" style={{ display: "inline-block", listStyle: "none" }}>
              Ver desglose ({registros.length} {registros.length === 1 ? "registro" : "registros"})
            </summary>
            <div style={{ marginTop: 16 }}>
              <DescargarCsv registros={registros} numero={numero} />
            </div>
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Perfil</th>
                  <th>Lleva invitado (+1)</th>
                  <th>Fecha de registro</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td><a href={`mailto:${r.correo}`}>{r.correo}</a></td>
                    <td>{r.perfil}</td>
                    <td>{r.invitado ? "Sí" : "No"}</td>
                    <td>{r.registrado}</td>
                    <td><BorrarRegistro registro={r.id} edicion={edicion} nombre={r.nombre} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </>
  );
}
