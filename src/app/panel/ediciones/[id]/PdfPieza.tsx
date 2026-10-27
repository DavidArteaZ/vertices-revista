"use client";

import { useActionState } from "react";
import type { Resultado } from "../../acciones";
import { fijarPdf } from "../acciones";

/**
 * La celda PDF de una pieza del número: el enlace si ya lo tiene, el motivo si
 * no, y la subida del PDF maquetado para estrenarlo o reemplazarlo.
 *
 * Es cliente porque el archivo no pasa por el servidor: se pide una URL
 * firmada y el navegador sube directo a Storage, igual que la plantilla de
 * doble ciego del dictamen.
 */

async function subir(articulo: number, archivo: File): Promise<Resultado> {
  try {
    const firma = await fetch(`/api/panel/articulos/${articulo}/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nombre: archivo.name, bytes: archivo.size }),
    });
    const respuesta = (await firma.json()) as { ruta?: string; url?: string; error?: string };

    if (!firma.ok || !respuesta.ruta || !respuesta.url) {
      return { ok: false, mensaje: respuesta.error ?? "No se pudo preparar la subida." };
    }

    const cuerpo = new FormData();
    cuerpo.append("cacheControl", "3600");
    cuerpo.append("", archivo.slice(0, archivo.size, "application/pdf"), archivo.name);

    const subida = await fetch(respuesta.url, { method: "PUT", body: cuerpo });
    if (!subida.ok) return { ok: false, mensaje: "No se pudo subir el PDF." };

    const datos = new FormData();
    datos.set("articulo", String(articulo));
    datos.set("ruta", respuesta.ruta);
    return await fijarPdf(datos);
  } catch {
    return { ok: false, mensaje: "No se pudo subir el PDF." };
  }
}

export default function PdfPieza({
  articulo,
  url,
  motivo,
}: {
  articulo: number;
  url: string | null;
  /** Por qué aún no hay PDF; sólo cuenta cuando `url` es null. */
  motivo: string | null;
}) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => {
      const archivo = datos.get("pdf");
      if (!(archivo instanceof File) || archivo.size === 0) {
        return { ok: false, mensaje: "Elige un PDF." };
      }
      return subir(articulo, archivo);
    },
    null,
  );

  return (
    <div style={{ minWidth: 190 }}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Ver PDF
        </a>
      ) : (
        <span className="etiqueta etiqueta--pendiente">No está lista</span>
      )}
      {!url && motivo && (
        <p className="nota" style={{ margin: "6px 0 0" }}>
          {motivo} Falta el PDF maquetado.
        </p>
      )}
      <form action={ejecutar} style={{ marginTop: 8 }}>
        <input
          type="file"
          name="pdf"
          accept="application/pdf,.pdf"
          aria-label={url ? "Otro PDF maquetado" : "PDF maquetado"}
          style={{ fontSize: 12, maxWidth: 190 }}
        />
        <button type="submit" className="boton" disabled={pendiente} style={{ marginTop: 6 }}>
          {pendiente ? "Subiendo…" : url ? "Cambiar PDF" : "Subir PDF maquetado"}
        </button>
        {estado?.mensaje && (
          <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>
        )}
      </form>
    </div>
  );
}
