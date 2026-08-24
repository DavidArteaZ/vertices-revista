"use client";

import { useActionState } from "react";
import type { Rubrica } from "@/lib/dictamen/rubrica";
import type { Resultado } from "../../acciones";
import { guardarBorrador, enviar } from "../acciones";

/**
 * El formulario de la tarjeta.
 *
 * Es cliente por una sola razón: el mismo <form> tiene dos botones —guardar y
 * enviar— y cada uno necesita su propio aviso. Todo lo demás lo resuelve el
 * servidor.
 *
 * El estado "sin contestar" es un radio más, con valor vacío, y no la ausencia
 * de radios marcados. Tiene que poder elegirse a propósito: quien marcó una
 * puerta por error necesita poder desmarcarla, y la diferencia entre "sin
 * contestar" y "No" no es cosmética — una puerta ★ sin contestar reprueba
 * igual que un No, pero una dimensión sin calificar no cuenta para el puntaje
 * mientras que un 0 sí.
 */

type Previa = {
  puntaje: number;
  maximo: number;
  puertasOk: boolean;
  criticosOk: boolean;
  etiqueta: string;
  motivo: string;
};

const MOTIVO: Record<string, string> = {
  pendiente: "Sin calificar todavía",
  falla_puerta: "Reprueba en una puerta ★",
  falla_critico: "Reprueba en una dimensión crítica ★",
  banda: "Por puntaje",
};

export default function Tarjeta({
  dictamenId,
  rubrica,
  puertas,
  puntajes,
  comentarios,
  sinConflicto,
  soloLectura,
  enviado,
  previa,
}: {
  dictamenId: string;
  rubrica: Rubrica;
  puertas: Record<string, boolean | null>;
  puntajes: Record<string, number | null>;
  comentarios: string;
  sinConflicto: boolean;
  soloLectura: boolean;
  enviado: boolean;
  previa: Previa | null;
}) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) =>
      datos.get("__accion") === "enviar" ? enviar(datos) : guardarBorrador(datos),
    null,
  );

  const valorPuerta = (id: number) => {
    if (!(id in puertas)) return "";
    return puertas[id] === true ? "si" : puertas[id] === false ? "no" : "";
  };

  const valorDim = (id: number) => {
    if (!(id in puntajes)) return "";
    return puntajes[id] === null ? "na" : String(puntajes[id]);
  };

  return (
    <form action={ejecutar}>
      <input type="hidden" name="dictamen" value={dictamenId} />

      <h3>Puertas</h3>
      <div className="tarjeta">
        <p className="nota" style={{ marginTop: 0 }}>
          Una puerta marcada con ★ es eliminatoria: si no es «Sí», la pieza no pasa,
          y dejarla sin contestar cuenta como no.
        </p>
        {rubrica.puertas.map((p) => (
          <div className="rubrica-fila" key={p.id}>
            <p className={p.esEliminatoria ? "critica" : undefined}>{p.etiqueta}</p>
            <div className="opciones">
              {[
                ["si", "Sí"],
                ["no", "No"],
                ["", "—"],
              ].map(([v, r]) => (
                <label key={v || "vacio"}>
                  <input
                    type="radio"
                    name={`puerta_${p.id}`}
                    value={v}
                    defaultChecked={valorPuerta(p.id) === v}
                    disabled={soloLectura}
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3>Dimensiones</h3>
      <div className="tarjeta">
        <p className="nota" style={{ marginTop: 0 }}>
          De 0 a 3. Una dimensión ★ por debajo de 2 reprueba la pieza entera, y
          dejarla sin calificar reprueba igual. Las que llevan ×2 pesan doble.
        </p>
        {rubrica.dimensiones.map((d) => (
          <div className="rubrica-fila" key={d.id}>
            <p className={d.esCritica ? "critica" : undefined}>{d.etiqueta}</p>
            <div className="opciones">
              {["0", "1", "2", "3"].map((v) => (
                <label key={v}>
                  <input
                    type="radio"
                    name={`dim_${d.id}`}
                    value={v}
                    defaultChecked={valorDim(d.id) === v}
                    disabled={soloLectura}
                  />
                  <span>{v}</span>
                </label>
              ))}
              {/* N/A sólo donde el libro lo admite: una sola dimensión en los
                  ocho instrumentos. Un disparador rechaza el resto. */}
              {d.permiteNa && (
                <label>
                  <input
                    type="radio"
                    name={`dim_${d.id}`}
                    value="na"
                    defaultChecked={valorDim(d.id) === "na"}
                    disabled={soloLectura}
                  />
                  <span>N/A</span>
                </label>
              )}
              <label>
                <input
                  type="radio"
                  name={`dim_${d.id}`}
                  value=""
                  defaultChecked={valorDim(d.id) === ""}
                  disabled={soloLectura}
                />
                <span>—</span>
              </label>
            </div>
          </div>
        ))}
      </div>

      {previa && (
        <div className="veredicto">
          <b>{previa.etiqueta}</b>
          <span>
            {previa.puntaje} de {previa.maximo} · puertas ★ {previa.puertasOk ? "ok" : "no"} ·
            críticos ★ {previa.criticosOk ? "ok" : "no"} · {MOTIVO[previa.motivo] ?? previa.motivo}
          </span>
          <span>
            {enviado
              ? "Ésta es la instantánea que se guardó al enviar."
              : "Lo que saldría con lo guardado hasta ahora. Se recalcula al guardar."}
          </span>
        </div>
      )}

      <h3>Comentarios</h3>
      <div className="tarjeta">
        <textarea
          name="comentarios"
          defaultValue={comentarios}
          disabled={soloLectura}
          placeholder="Lo que el comité necesita saber y la rúbrica no recoge."
        />
        <label className="nota" style={{ display: "flex", gap: 8, marginTop: 12, textTransform: "none", letterSpacing: 0, fontSize: 14 }}>
          <input type="checkbox" name="sin_conflicto" defaultChecked={sinConflicto} disabled={soloLectura} style={{ width: "auto" }} />
          {/* El cruce de correos no detecta la coautoría: esto es lo único que
              hay contra ella (spec §7.3). */}
          No participé en la elaboración de esta pieza.
        </label>
      </div>

      {!soloLectura && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20 }}>
          <button type="submit" className="boton" disabled={pendiente} name="__accion" value="guardar">
            {pendiente ? "Guardando…" : "Guardar borrador"}
          </button>
          <button
            type="submit"
            className="boton boton--lleno"
            disabled={pendiente}
            name="__accion"
            value="enviar"
            onClick={(e) => {
              if (
                !window.confirm(
                  "Enviar el dictamen es definitivo: no se puede volver a borrador ni corregir después, y a partir de ese momento verás la autoría de esta pieza. ¿Continuar?",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            Enviar dictamen
          </button>
        </div>
      )}

      {enviado && (
        <p className="nota">
          Enviado. Una tarjeta enviada no vuelve a borrador ni se corrige: es la
          instantánea de lo que el comité vio el día que dictaminó.
        </p>
      )}

      {estado?.mensaje && (
        <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>
      )}
    </form>
  );
}
