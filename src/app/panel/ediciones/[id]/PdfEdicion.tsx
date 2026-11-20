"use client";

import { useActionState } from "react";
import type { Resultado } from "../../acciones";
import { fijarPdfFinal } from "../pdf-final";

/**
 * El PDF de la edición final: el número entero en un documento, aparte de los
 * PDF de cada pieza. Sube directo a Storage con URL firmada, como `PdfPieza`,
 * porque una Function de Vercel no acepta cuerpos de más de 4.5 MB.
 */

async function subir(edicion: number, archivo: File): Promise<Resultado> {
  try {
    const firma = await fetch(`/api/panel/ediciones/${edicion}/pdf`, {
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
    datos.set("edicion", String(edicion));
    datos.set("ruta", respuesta.ruta);
    return await fijarPdfFinal(datos);
  } catch (e) {
    console.error(JSON.stringify({ evento: "panel_pdf_final_subida_fallo", edicion, error: String(e) }));
    return { ok: false, mensaje: "No se pudo subir el PDF." };
  }
}

export default function PdfEdicion({
  edicion,
  url,
  enlacePublico,
}: {
  edicion: number;
  url: string | null;
  /** La página pública del número; sólo existe una vez publicado. */
  enlacePublico: string | null;
}) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => {
      const archivo = datos.get("pdf");
      if (!(archivo instanceof File) || archivo.size === 0) {
        return { ok: false, mensaje: "Elige un PDF." };
      }
      return subir(edicion, archivo);
    },
    null,
  );

  return (
    <div>
      <p className="nota" style={{ marginTop: 0 }}>
        El número completo maquetado en un solo PDF. Es necesario para publicar y se
        ve en la página del número. No cambia el PDF ni el enlace de ningún artículo.
      </p>
      <p style={{ margin: "0 0 10px" }}>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Ver PDF de la edición final
          </a>
        ) : (
          <span className="etiqueta etiqueta--pendiente">Falta el PDF</span>
        )}
        {enlacePublico && (
          <>
            {" · "}
            <a href={enlacePublico} target="_blank" rel="noopener noreferrer">
              Página pública del número
            </a>
          </>
        )}
      </p>
      <form action={ejecutar}>
        <input
          type="file"
          name="pdf"
          accept="application/pdf,.pdf"
          aria-label={url ? "Otro PDF de la edición final" : "PDF de la edición final"}
          style={{ fontSize: 12 }}
        />
        <button type="submit" className="boton" disabled={pendiente} style={{ marginTop: 6 }}>
          {pendiente ? "Subiendo…" : url ? "Cambiar PDF final" : "Subir PDF final"}
        </button>
        {estado?.mensaje && (
          <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>
        )}
      </form>
    </div>
  );
}
