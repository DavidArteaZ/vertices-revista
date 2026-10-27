"use client";

import type { Invitado } from "./Invitados";

/** Comillas siempre: nombres con coma o comillas no deben partir la columna. */
const celda = (valor: string) => `"${valor.replace(/"/g, '""')}"`;

/**
 * El CSV se arma en el navegador con lo que ya trae la página: los datos sólo
 * llegan aquí si la sesión es del comité, así que no hace falta otra ruta.
 */
export default function DescargarCsv({ registros, numero }: { registros: Invitado[]; numero: number }) {
  function descargar() {
    const filas = [
      ["Nombre", "Correo", "Perfil", "Lleva invitado (+1)", "Fecha de registro"],
      ...registros.map((r) => [r.nombre, r.correo, r.perfil, r.invitado ? "Sí" : "No", r.registrado]),
    ];
    // El BOM le dice a Excel que es UTF-8; sin él, los acentos salen rotos.
    const texto = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vertices-invitados-edicion-${numero}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="boton" onClick={descargar}>
      Descargar CSV
    </button>
  );
}
