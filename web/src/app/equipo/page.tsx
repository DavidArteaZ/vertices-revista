"use client";

import { useRouter } from "next/navigation";
import "./equipo.css";

/**
 * Página en construcción del equipo. Portada de equipo-ds.html:31-39.
 *
 * El enlace de regreso usa history.back() cuando hay historial y cae a la
 * raíz cuando no, igual que el original (equipo-ds.html:38).
 */
export default function Pagina() {
  const router = useRouter();

  return (
    <main>
      <p className="ceja">Vértices · Revista académica de economía</p>
      <h1>Conoce al equipo</h1>
      <p>Página en construcción. Aquí vivirán los siete equipos que hacen la revista: Dirección General, Comité Editorial, Contenido y Alianzas, Producción, Diseño, Comunicación y Difusión, y Fotografía y Archivo.</p>
      <a
        className="regreso"
        href="/"
        onClick={(e) => {
          if (window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
      >
        ← Regresar
      </a>
    </main>
  );
}
