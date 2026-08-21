"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Pie de página. Marcado de index.html:914-959, boletín de :2269-2274.
 *
 * El boletín no envía nada: sustituye el formulario por un agradecimiento.
 * Es exactamente lo que hace el sitio hoy y esta etapa lo preserva; la
 * etapa 4 decidirá si se conecta de verdad.
 */
export default function Pie() {
  const [suscrito, setSuscrito] = useState(false);
  const [correo, setCorreo] = useState("");

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return;
    setSuscrito(true);
  };

  return (
    <footer className="pie">
      <div className="pie-int">
        <div className="pie-rejilla">
          <div className="pie-marca">
            <a className="marca" href="#" data-u="0">
              <svg className="emblema" viewBox="0 0 40 40" aria-hidden="true">
                <path d="M20 5 L35 32 L5 32 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M20 5 L21.5 22.5 M5 32 L21.5 22.5 M35 32 L21.5 22.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
              </svg>
              <span>Vértices</span>
            </a>
            <p>Revista académica de economía nacida en la Licenciatura en Economía del Tecnológico de Monterrey, Campus Ciudad de México. De economistas para economistas y para quien quiera entender.</p>
          </div>
          <div>
            <h4>Explora</h4>
            <ul>
              <li><a href="#temas" data-u="0.48">Temas</a></li>
              <li><a href="#secciones" data-u="0.75">Secciones</a></li>
              <li><a href="#convocatoria" data-ir="convocatoria">Convocatoria</a></li>
              <li><a href="#lineamientos" data-ir="lineamientos">Lineamientos</a></li>
              <li><a href="#estado" data-ir="estado">Estado de tu envío</a></li>
            </ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li><a href="mailto:vertices@servicios.tec.mx">vertices@servicios.tec.mx</a></li>
              <li><a href="#" rel="noopener">Instagram · @vertices.ccm</a></li>
              <li><a href="#" rel="noopener">LinkedIn · Vértices CCM</a></li>
            </ul>
          </div>
          <div className="boletin">
            <h4>Boletín</h4>
            <p>Recibe cada edición y las convocatorias en tu correo.</p>
            {suscrito ? (
              <p style={{ color: "var(--crema)" }}>Listo, recibirás la próxima edición en tu correo.</p>
            ) : (
              <form id="boletinForm" onSubmit={enviar}>
                <input
                  type="email"
                  id="boletinCorreo"
                  placeholder="tu correo"
                  aria-label="Tu correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                <button className="boton" type="submit">Suscribirme</button>
              </form>
            )}
          </div>
        </div>
        <div className="pie-legal">
          <span>© 2026 Vértices · Tecnológico de Monterrey, Campus Ciudad de México</span>
          <span>Rigurosa en evidencia, amable en lectura · <a href="#">Aviso de privacidad</a></span>
        </div>
      </div>
    </footer>
  );
}
