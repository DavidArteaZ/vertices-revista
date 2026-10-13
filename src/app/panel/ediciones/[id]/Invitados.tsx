export type Invitado = {
  id: number;
  nombre: string;
  correo: string;
  perfil: string;
  invitado: boolean;
};

/**
 * Quiénes se registraron en /registro para el evento de este número. El
 * contador es de personas, no de registros: quien lleva +1 cuenta por dos.
 */
export default function Invitados({ registros, error }: { registros: Invitado[]; error: boolean }) {
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
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Perfil</th>
                  <th>Lleva invitado (+1)</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nombre}</td>
                    <td><a href={`mailto:${r.correo}`}>{r.correo}</a></td>
                    <td>{r.perfil}</td>
                    <td>{r.invitado ? "Sí" : "No"}</td>
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
