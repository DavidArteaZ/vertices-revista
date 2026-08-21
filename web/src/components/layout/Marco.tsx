"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SelectorIdioma from "./SelectorIdioma";

/**
 * Marco fijo: marca y navegación en los márgenes.
 * Marcado de index.html:597-620, comportamiento del menú de :2389-2400.
 *
 * Los anclas internas (#temas, #secciones, #convocatoria, #estado) y sus
 * atributos data-u / data-ir se conservan intactos: el motor los lee en su
 * manejador delegado de clic.
 */
export default function Marco({
  satelite = false,
  style,
}: { satelite?: boolean; style?: React.CSSProperties } = {}) {
  const [abierto, setAbierto] = useState(false);
  const nav = useRef<HTMLElement>(null);

  // En la landing las anclas llevan data-u / data-ir y las gobierna el motor.
  // En las páginas satélite no hay motor, así que apuntan a la raíz con hash
  // (lineamientos.html:244-266).
  const a = (hash: string) => (satelite ? `/${hash}` : hash);
  const datos = (d: Record<string, string>) => (satelite ? {} : d);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!nav.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("click", fuera);
    return () => document.removeEventListener("click", fuera);
  }, []);

  return (
    <header className="marco" style={style}>
      <a className="marca" href={satelite ? "/" : "#"} {...datos({ "data-u": "0" })}>
        <svg className="emblema" viewBox="0 0 40 40" aria-hidden="true">
          <path d="M20 5 L35 32 L5 32 Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M20 5 L21.5 22.5 M5 32 L21.5 22.5 M35 32 L21.5 22.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
        </svg>
        <span>Vértices</span>
      </a>
      <nav ref={nav} aria-label="Navegación principal" className={abierto ? "abierto" : undefined}>
        <Link className="enlace enlace-bar" href="/quienes-somos">Acerca de</Link>
        <Link className="boton boton-bar" href="/equipo">Conoce al equipo</Link>
        <a className="boton boton--lleno" href={a("#envio")} {...datos({ "data-ir": "envio" })}>Publica tu artículo</a>
        <SelectorIdioma />
        <button
          className="menu-boton"
          type="button"
          aria-label="Menú"
          aria-expanded={abierto}
          aria-controls="menuPanel"
          onClick={() => setAbierto((v) => !v)}
        >
          <i></i><i></i><i></i>
        </button>
        <div className="menu-panel" id="menuPanel" onClick={() => setAbierto(false)}>
          <a className="enlace" href={a("#temas")} {...datos({ "data-u": "0.48" })}>Temas</a>
          <a className="enlace" href={a("#secciones")} {...datos({ "data-u": "0.75" })}>Secciones</a>
          <a className="enlace" href={a("#convocatoria")} {...datos({ "data-ir": "convocatoria" })}>Convocatoria</a>
          <Link className="enlace" href="/lineamientos">Lineamientos</Link>
          <a className="enlace" href={a("#estado")} {...datos({ "data-ir": "estado" })}>Estado de tu envío</a>
          <Link className="enlace solo-angosto" href="/quienes-somos">Acerca de</Link>
          <Link className="enlace solo-angosto" href="/equipo">Conoce al equipo</Link>
        </div>
      </nav>
    </header>
  );
}
