import "server-only";
import Link from "next/link";
import { redirect } from "next/navigation";
import { personal, type Personal } from "@/lib/supabase/sesion";
import { salir } from "./acciones";

/**
 * La guardia, y la cabecera que la acompaña.
 *
 * Cada página del panel la llama. No está en el layout porque un layout de
 * Next no se re-ejecuta en cada navegación de cliente: una autorización que
 * puede no correr no es una autorización.
 *
 * Aun así, esto es comodidad, no el candado. El candado es RLS: aunque alguien
 * llegara a una página sin ser del comité, `privado.es_staff()` devuelve falso
 * y toda consulta trae cero filas. Por eso las acciones de servidor vuelven a
 * comprobar por su cuenta en vez de fiarse de que la página lo hizo.
 */
export async function exigePersonal(): Promise<Personal> {
  const quien = await personal();
  if (!quien) redirect("/panel/entrar");
  return quien;
}

export function Cabecera({ quien }: { quien: Personal }) {
  return (
    <header className="panel-cabecera">
      <h1>
        <Link href="/panel" style={{ color: "inherit" }}>Vértices · Panel</Link>
      </h1>
      <span className="panel-quien">{quien.nombre}</span>
      <nav>
        <Link href="/panel">Cola</Link>
        <Link href="/panel/equipo">Equipo</Link>
        <form action={salir}>
          <button type="submit">Salir</button>
        </form>
      </nav>
    </header>
  );
}
