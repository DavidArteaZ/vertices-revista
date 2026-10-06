"use client";

import { FormEvent, useState } from "react";

const PERFILES = ["Autor/a", "Comunidad TEC", "Colaborador/a", "Autoridad"] as const;

export default function FormularioRegistro() {
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [ok, setOk] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnviando(true);
    setMensaje("");

    const form = new FormData(e.currentTarget);
    const cuerpo = {
      nombre: String(form.get("nombre") ?? ""),
      correo: String(form.get("correo") ?? ""),
      perfil: String(form.get("perfil") ?? ""),
    };

    try {
      const respuesta = await fetch("/api/registro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const dato = await respuesta.json();

      if (!respuesta.ok) {
        setOk(false);
        setMensaje(dato?.mensaje || "No se pudo completar el registro. Inténtalo de nuevo.");
        return;
      }

      setOk(true);
      setMensaje("Tu registro quedó confirmado.");
      e.currentTarget.reset();
    } catch {
      setOk(false);
      setMensaje("No se pudo completar el registro. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="registro-form" onSubmit={enviar}>
      <div className="registro-campo">
        <label htmlFor="nombre">Nombre completo</label>
        <input id="nombre" name="nombre" type="text" autoComplete="name" required maxLength={160} />
      </div>

      <div className="registro-campo">
        <label htmlFor="correo">Correo electrónico</label>
        <input id="correo" name="correo" type="email" autoComplete="email" required maxLength={254} />
      </div>

      <div className="registro-campo">
        <label htmlFor="perfil">Perfil</label>
        <select id="perfil" name="perfil" required defaultValue="">
          <option value="" disabled>Selecciona una opción</option>
          {PERFILES.map((perfil) => <option key={perfil} value={perfil}>{perfil}</option>)}
        </select>
      </div>

      <button className="registro-boton" type="submit" disabled={enviando}>
        {enviando ? "Registrando…" : "Registrarme"}
      </button>

      <p className={`registro-resultado ${mensaje ? (ok ? "ok" : "error") : ""}`} aria-live="polite">
        {mensaje}
      </p>
    </form>
  );
}
