import FormEntrar from "./FormEntrar";

/**
 * Entrada al panel. Sólo correo y contraseña: las cuentas son por invitación
 * (spec §13), así que no hay alta pública ni la habrá — la invitación la manda
 * el comité desde /panel/equipo.
 *
 * La página es de servidor sólo para leer `motivo`. Es a donde manda
 * /panel/auth/callback cuando un enlace no se pudo canjear, y sin ese aviso la
 * pantalla pedía una contraseña que la persona nunca había llegado a fijar sin
 * explicar por qué.
 *
 * No hay «olvidé mi contraseña» todavía. Lo que hay es el botón de reenviar de
 * /panel/equipo, que manda un enlace de recuperación con el mismo aterrizaje
 * que una invitación.
 */

export const dynamic = "force-dynamic";

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  return (
    <main className="panel-marco">
      <div className="entrar">
        <h2>Panel editorial</h2>
        <p className="nota">Vértices · Facultad de Economía</p>

        <FormEntrar motivo={motivo} />
      </div>
    </main>
  );
}
