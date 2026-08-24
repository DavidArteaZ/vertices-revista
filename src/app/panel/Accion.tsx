"use client";

import { useActionState } from "react";
import type { Resultado } from "./acciones";

/**
 * Un <form> que llama a una acción de servidor y enseña lo que respondió.
 *
 * Existe para que las páginas del panel puedan seguir siendo componentes de
 * servidor: aquí está lo único que necesita estado —el resultado de la última
 * llamada y el "guardando…"— y nada más cruza al navegador.
 */
export default function Accion({
  accion,
  children,
  etiqueta,
  lleno,
  confirmar,
}: {
  accion: (datos: FormData) => Promise<Resultado>;
  children?: React.ReactNode;
  etiqueta: string;
  lleno?: boolean;
  /** Para lo que no se puede deshacer: grabar una decisión, enviar un dictamen. */
  confirmar?: string;
}) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => accion(datos),
    null,
  );

  return (
    <form
      action={ejecutar}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      <button
        type="submit"
        className={`boton${lleno ? " boton--lleno" : ""}`}
        disabled={pendiente}
      >
        {pendiente ? "Guardando…" : etiqueta}
      </button>
      {estado?.mensaje && (
        <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>
      )}
    </form>
  );
}
