"use client";

import { useActionState } from "react";
import type { Resultado } from "../../acciones";
import { cambiarCarrusel, fijarImagenCarrusel } from "../carrusel";

/**
 * La edición en la portada: las tres imágenes de la parada (portada al centro
 * y dos pliegos detrás) y el switch que la enciende. Las imágenes suben
 * directo a Storage con URL firmada, como los PDF.
 */

type Hueco = "portada" | "pliego-izq" | "pliego-der";

const HUECOS: { hueco: Hueco; etiqueta: string; nota: string }[] = [
  { hueco: "pliego-izq", etiqueta: "Pliego izquierdo", nota: "Dos páginas, horizontal" },
  { hueco: "portada", etiqueta: "Portada", nota: "Sola o junto con la contraportada: se muestra la mitad izquierda" },
  { hueco: "pliego-der", etiqueta: "Pliego derecho", nota: "Dos páginas, horizontal" },
];

/** Lo que Storage dijo al rechazar la subida, para enseñarlo en vez de adivinar. */
async function motivoStorage(r: Response): Promise<string> {
  try {
    const cuerpo = (await r.json()) as { message?: string; error?: string };
    return cuerpo.message ?? cuerpo.error ?? `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status}`;
  }
}

async function subir(edicion: number, hueco: Hueco, archivo: File): Promise<Resultado> {
  try {
    const firma = await fetch(`/api/panel/ediciones/${edicion}/carrusel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hueco, mime: archivo.type, bytes: archivo.size }),
    });
    const respuesta = (await firma.json()) as { ruta?: string; url?: string; error?: string };
    if (!firma.ok || !respuesta.ruta || !respuesta.url) {
      return { ok: false, mensaje: respuesta.error ?? "No se pudo preparar la subida." };
    }

    const cuerpo = new FormData();
    cuerpo.append("cacheControl", "3600");
    cuerpo.append("", archivo, archivo.name);
    const subida = await fetch(respuesta.url, { method: "PUT", body: cuerpo });
    if (!subida.ok) return { ok: false, mensaje: `No se pudo subir la imagen: ${await motivoStorage(subida)}` };

    const datos = new FormData();
    datos.set("edicion", String(edicion));
    datos.set("hueco", hueco);
    datos.set("ruta", respuesta.ruta);
    return await fijarImagenCarrusel(datos);
  } catch (e) {
    console.error(JSON.stringify({ evento: "panel_carrusel_subida_fallo", edicion, hueco, error: String(e) }));
    return { ok: false, mensaje: "No se pudo subir la imagen." };
  }
}

function Imagen({ edicion, hueco, etiqueta, nota, url }: { edicion: number; hueco: Hueco; etiqueta: string; nota: string; url: string | null }) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(async (_p, datos) => {
    const archivo = datos.get("imagen");
    if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, mensaje: "Elige una imagen." };
    return subir(edicion, hueco, archivo);
  }, null);

  return (
    <form action={ejecutar} className="carrusel-hueco">
      <p className="carrusel-hueco__nombre">{etiqueta}</p>
      <div className={`carrusel-hueco__vista${hueco === "portada" ? " carrusel-hueco__vista--vertical" : ""}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de un archivo del bucket
          <img src={url} alt={etiqueta} />
        ) : (
          <span className="nota">{nota}</span>
        )}
      </div>
      <input type="file" name="imagen" accept="image/jpeg,image/png,image/webp" aria-label={etiqueta} style={{ fontSize: 12, maxWidth: "100%" }} />
      <button type="submit" className="boton" disabled={pendiente} style={{ marginTop: 6 }}>
        {pendiente ? "Subiendo…" : url ? "Cambiar" : "Subir"}
      </button>
      {estado?.mensaje && <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>}
    </form>
  );
}

export default function CarruselEdicion({
  edicion,
  encendido,
  activa,
  publicada,
  imagenes,
}: {
  edicion: number;
  encendido: boolean;
  activa: boolean;
  publicada: boolean;
  imagenes: Record<Hueco, string | null>;
}) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_p, datos) => cambiarCarrusel(datos),
    null,
  );

  const faltan: string[] = [];
  if (!activa) faltan.push("ser la edición activa");
  if (!publicada) faltan.push("estar publicada");
  if (!imagenes.portada || !imagenes["pliego-izq"] || !imagenes["pliego-der"]) faltan.push("tener las tres imágenes");
  const sePuede = faltan.length === 0;

  return (
    <div>
      <p className="nota" style={{ marginTop: 0 }}>
        Una parada del recorrido de la portada que anuncia el número, con la portada al centro y dos
        pliegos detrás. Los botones llevan a la página del número.
      </p>
      <div className="carrusel-huecos">
        {HUECOS.map((h) => (
          <Imagen key={h.hueco} edicion={edicion} url={imagenes[h.hueco]} {...h} />
        ))}
      </div>

      <form action={ejecutar} className="carrusel-switch">
        <input type="hidden" name="edicion" value={edicion} />
        <input type="hidden" name="encender" value={encendido ? "0" : "1"} />
        <button
          type="submit"
          role="switch"
          aria-checked={encendido}
          className={`interruptor${encendido ? " interruptor--on" : ""}`}
          disabled={pendiente || (!encendido && !sePuede)}
        >
          <span className="interruptor__riel" aria-hidden="true"><span className="interruptor__bola" /></span>
          {encendido ? "En la portada" : "Mostrar en la portada"}
        </button>
        {!encendido && !sePuede && (
          <p className="nota" style={{ margin: 0 }}>Para encenderlo, la edición necesita {faltan.join(", ")}.</p>
        )}
        {encendido && !(activa && publicada) && (
          <p className="nota" style={{ margin: 0 }}>Está encendido, pero no se ve porque esta ya no es la edición activa.</p>
        )}
      </form>
      {estado?.mensaje && <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>}
    </div>
  );
}
