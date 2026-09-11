"use client";

import { useActionState, useRef, useState } from "react";
import {
  DECISIONES_FINALES,
  requiereComentarios,
  type DecisionFinal,
} from "@/lib/decisiones-finales";
import { registrarDecision, type Resultado } from "../../acciones";

type Edicion = { id: number; numero: number; titulo: string };

export default function FormularioDecision({
  envio,
  ediciones,
  locale,
}: {
  envio: string;
  ediciones: Edicion[];
  locale: string;
}) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => registrarDecision(datos),
    null,
  );
  const [decision, setDecision] = useState<DecisionFinal | "">("");
  const [confirmando, setConfirmando] = useState(false);
  const [nombre, setNombre] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  const permitirEnvio = useRef(false);

  const pideComentarios = decision ? requiereComentarios(decision) : false;

  function abrirConfirmacion() {
    if (!formulario.current?.reportValidity()) return;
    setConfirmando(true);
  }

  return (
    <form
      ref={formulario}
      action={ejecutar}
      onSubmit={(e) => {
        if (permitirEnvio.current) {
          permitirEnvio.current = false;
          return;
        }
        e.preventDefault();
        abrirConfirmacion();
      }}
    >
      <input type="hidden" name="envio" value={envio} />

      <div className="fila">
        <div className="campo">
          <label htmlFor="decision">Decisión del comité</label>
          <select
            id="decision"
            name="decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as DecisionFinal | "")}
            required
          >
            <option value="">Elige una</option>
            {DECISIONES_FINALES.map((opcion) => (
              <option key={opcion} value={opcion}>{opcion}</option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="edicion">Edición para el correo</label>
          <select id="edicion" name="edicion" defaultValue="" required>
            <option value="">Elige una</option>
            {ediciones.map((edicion) => (
              <option key={edicion.id} value={edicion.id}>
                {edicion.titulo} · número {edicion.numero}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="nota" style={{ marginTop: -6, marginBottom: 16 }}>
        La edición se usa para completar el correo. No convierte la pieza en artículo ni la vincula automáticamente al número.
      </p>

      {pideComentarios && (
        <div className="campo">
          <label htmlFor="comentarios">Revisiones o comentarios</label>
          <textarea id="comentarios" name="comentarios" required />
          {locale !== "es" && (
            <p className="nota">
              Este autor recibirá la plantilla en inglés. Escribe los comentarios directamente en inglés.
            </p>
          )}
        </div>
      )}

      <button type="button" className="boton boton--lleno" onClick={abrirConfirmacion} disabled={pendiente}>
        {pendiente ? "Guardando…" : "Grabar decisión"}
      </button>

      {estado?.mensaje && (
        <p className={`aviso${estado.ok ? " aviso--ok" : ""}`}>{estado.mensaje}</p>
      )}

      {confirmando && (
        <div className="modal-fondo" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="confirmar-decision-titulo">
            <h3 id="confirmar-decision-titulo" style={{ marginTop: 0 }}>Confirmar decisión</h3>
            <p className="nota">La decisión que se registrará y comunicará al autor es:</p>
            <p className="decision-confirmada">{decision.toUpperCase()}</p>
            <div className="campo">
              <label htmlFor="confirmacion_nombre">Escribe tu nombre para dejar constancia</label>
              <input
                id="confirmacion_nombre"
                name="confirmacion_nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="modal-acciones">
              <button type="button" className="boton" onClick={() => setConfirmando(false)} disabled={pendiente}>
                Cancelar
              </button>
              <button
                type="submit"
                className="boton boton--lleno"
                disabled={pendiente || !nombre.trim()}
                onClick={() => { permitirEnvio.current = true; }}
              >
                {pendiente ? "Guardando…" : "Confirmar y enviar correo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
