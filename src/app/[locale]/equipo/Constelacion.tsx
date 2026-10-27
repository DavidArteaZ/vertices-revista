"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ASESOR, INTEGRANTES, type AreaId, type Integrante } from "@/lib/datos/equipo";
import {
  curva, disponer, ESCRITORIO, MOVIL, R_AREA, R_ASESOR, R_CENTRO,
  type Burbuja, type Lienzo,
} from "@/lib/equipo-disposicion";

/**
 * La constelación del equipo: cada área es un nodo, cada persona cuelga de su
 * área y quien está en dos queda unida a ambas. Lo pidió el comité en lugar de
 * burbujas sueltas, para seguir el recurso gráfico del Manual de Identidad
 * (puntos de color del kit unidos por líneas).
 *
 * Se dibujan dos lienzos, el ancho y el alto, y equipo.css enseña uno según
 * html[data-disp]. Elegirlo aquí con JS haría que el teléfono pintara primero
 * el de escritorio y saltara al hidratar.
 */

// color de relleno de cada área y, aparte, el del texto que va encima
const COLOR: Record<AreaId, string> = {
  dir: "var(--indigo)",
  con: "var(--beige)",
  ced: "var(--perla)",
  dis: "var(--coral)",
  cyd: "var(--ambar)",
  fot: "var(--pizarra)",
};
const TEXTO: Record<AreaId, string> = {
  dir: "#fff", con: "var(--tinta)", ced: "#fff", dis: "#fff", cyd: "var(--tinta)", fot: "#fff",
};
// El beige casi desaparece como anillo o punto sobre el crema; ahí se usa su
// contorno café, el mismo que rodea su nodo.
const TRAZO: Record<AreaId, string> = { ...COLOR, con: "var(--contorno-beige)" };

const NOMBRE_AREA: Record<AreaId, string> = {
  dir: "direccion_general",
  con: "contenido_y_alianzas",
  ced: "comite_editorial",
  dis: "diseno",
  cyd: "comunicacion_y_difusion",
  fot: "fotografia_y_archivo",
};

/** Parte un nombre largo en dos renglones por el espacio más cercano a la mitad. */
function renglones(texto: string): string[] {
  if (texto.length <= 10 || !texto.includes(" ")) return [texto];
  const mitad = texto.length / 2;
  let corte = -1;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === " " && (corte < 0 || Math.abs(i - mitad) < Math.abs(corte - mitad))) corte = i;
  }
  return [texto.slice(0, corte), texto.slice(corte + 1)];
}

type Activo = { tipo: "persona"; nombre: string } | { tipo: "area"; id: AreaId } | null;

function Mapa({ lienzo, clase }: { lienzo: Lienzo; clase: string }) {
  const t = useTranslations("equipo");
  const [activo, setActivo] = useState<Activo>(null);
  const [fijado, setFijado] = useState(false);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const caja = useRef<HTMLDivElement>(null);

  // seiscientas pasadas de repulsión: una vez por lienzo, no en cada hover
  const burbujas = useMemo(() => disponer(lienzo, INTEGRANTES), [lienzo]);
  const asesor: Burbuja = { ...lienzo.asesor, r: R_ASESOR, persona: ASESOR };
  const areas = Object.entries(lienzo.areas) as [AreaId, { x: number; y: number }][];
  const enfocada = activo?.tipo === "persona" ? [...burbujas, asesor].find((b) => b.persona.nombre === activo.nombre) : undefined;

  // Un toque fuera de la constelación suelta la ficha fijada.
  useEffect(() => {
    if (!fijado) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) { setFijado(false); setActivo(null); }
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [fijado]);

  // La ficha tiene enlaces: se le da un instante a la persona para llegar a
  // ella desde la burbuja antes de cerrarla.
  const abrir = (a: Activo) => { clearTimeout(espera.current); setActivo(a); };
  const cerrarPronto = () => {
    if (fijado) return;
    clearTimeout(espera.current);
    espera.current = setTimeout(() => setActivo(null), 260);
  };

  const encendida = (p: Integrante) =>
    activo?.tipo === "persona" ? activo.nombre === p.nombre : activo?.tipo === "area" ? p.areas.includes(activo.id) : false;
  const lineaViva = (area: AreaId, p: Integrante) =>
    activo?.tipo === "persona" ? activo.nombre === p.nombre : activo?.tipo === "area" && activo.id === area;

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className={`constelacion ${clase}`} ref={caja}>
      <svg
        viewBox={`0 0 ${lienzo.ancho} ${lienzo.alto}`}
        className={activo ? "atenuado" : undefined}
        role="group"
        aria-label={t("mapa_del_equipo_de_vertices_por_areas")}
      >
        {areas.map(([id, a], i) => (
          <path key={`c-${id}`} className="linea" d={curva(lienzo.centro, a, i % 2 ? 0.12 : -0.12)} />
        ))}
        {burbujas.map((b, i) =>
          b.persona.areas.map((id, j) => (
            <path
              key={`l-${b.persona.nombre}-${id}`}
              className={lineaViva(id, b.persona) ? "linea viva" : "linea"}
              d={curva(lienzo.areas[id], b, (j ? -1 : 1) * (i % 2 ? 0.12 : -0.12))}
            />
          )),
        )}

        <g className="nodo-centro" aria-hidden="true">
          <circle cx={lienzo.centro.x} cy={lienzo.centro.y} r={R_CENTRO} />
          <text x={lienzo.centro.x} y={lienzo.centro.y + 6.5}>{t("vertices")}</text>
        </g>

        {areas.map(([id, a]) => {
          const nombre = t(NOMBRE_AREA[id]);
          const lineas = renglones(nombre);
          return (
            <g
              key={id}
              className={`nodo-area area-${id}`}
              tabIndex={0}
              role="button"
              aria-label={t("integrantes_de_area", { area: nombre })}
              onMouseEnter={() => abrir({ tipo: "area", id })}
              onMouseLeave={cerrarPronto}
              onFocus={() => abrir({ tipo: "area", id })}
              onBlur={cerrarPronto}
              onClick={() => { abrir({ tipo: "area", id }); setFijado(true); }}
            >
              <circle cx={a.x} cy={a.y} r={R_AREA} style={{ fill: COLOR[id] }} />
              {lineas.map((l, i) => (
                <text key={i} x={a.x} y={a.y + (i - (lineas.length - 1) / 2) * 15 + 4.5} style={{ fill: TEXTO[id] }}>{l}</text>
              ))}
            </g>
          );
        })}

        {[...burbujas, asesor].map((b, i) => {
          const [a1, a2] = b.persona.areas;
          const esAsesor = b.persona === ASESOR;
          const r = a2 ? b.r - 6 : b.r;
          const idClip = `${clase}-foto-${i}`;
          const encender = () => abrir({ tipo: "persona", nombre: b.persona.nombre });
          return (
            <g
              key={b.persona.nombre}
              className={["persona", encendida(b.persona) && "encendida", activo && !encendida(b.persona) && "apagada"].filter(Boolean).join(" ")}
              tabIndex={0}
              role="button"
              aria-label={b.persona.nombre}
              onMouseEnter={encender}
              onMouseLeave={cerrarPronto}
              onFocus={encender}
              onBlur={cerrarPronto}
              onClick={() => { encender(); setFijado(true); }}
            >
              <g className="escala">
                <clipPath id={idClip}><circle cx={b.x} cy={b.y} r={r} /></clipPath>
                {a2 && <circle className="anillo" cx={b.x} cy={b.y} r={b.r - 1.5} style={{ stroke: TRAZO[a2] }} />}
                {esAsesor && <circle className="anillo-asesor" cx={b.x} cy={b.y} r={b.r + 6} />}
                <g className="tinte" clipPath={`url(#${idClip})`}>
                  <circle cx={b.x} cy={b.y} r={r} style={{ fill: esAsesor ? "var(--tinta)" : COLOR[a1] }} />
                  <image className="foto" href={`/equipo/${b.persona.foto}.webp`} x={b.x - r} y={b.y - r} width={r * 2} height={r * 2} />
                  <image className="foto real" href={`/equipo/${b.persona.foto}.webp`} x={b.x - r} y={b.y - r} width={r * 2} height={r * 2} />
                </g>
                <circle className="foco" cx={b.x} cy={b.y} r={b.r + 3} />
              </g>
            </g>
          );
        })}
        <text className="asesor-nombre" x={asesor.x} y={asesor.y + R_ASESOR + 30}>{ASESOR.nombre}</text>
        <text className="asesor-etiqueta" x={asesor.x} y={asesor.y + R_ASESOR + 48}>{t("asesor")}</text>
      </svg>

      {enfocada && (
        <div
          className="ficha"
          style={{ left: pct(enfocada.x, lienzo.ancho), top: pct(enfocada.y + enfocada.r + 4, lienzo.alto) }}
          onMouseEnter={() => clearTimeout(espera.current)}
          onMouseLeave={cerrarPronto}
          onFocus={() => clearTimeout(espera.current)}
          onBlur={cerrarPronto}
        >
          <p className="ficha-nombre">{enfocada.persona.nombre}</p>
          <p className="ficha-areas">
            {enfocada.persona === ASESOR
              ? <span>{t("asesor")}</span>
              : enfocada.persona.areas.map((id) => (
                  <span key={id}><i style={{ background: COLOR[id], boxShadow: `inset 0 0 0 1px ${TRAZO[id]}` }} />{t(NOMBRE_AREA[id])}</span>
                ))}
          </p>
          {(enfocada.persona.linkedin || enfocada.persona.portafolio) && (
            <p className="ficha-redes">
              {enfocada.persona.linkedin && (
                <a className="red-li" href={enfocada.persona.linkedin} target="_blank" rel="noopener" aria-label={t("linkedin")}>in</a>
              )}
              {enfocada.persona.portafolio && (
                <a className="red-ig" href={enfocada.persona.portafolio} target="_blank" rel="noopener" aria-label={t("portafolio_en_instagram")}>ig</a>
              )}
            </p>
          )}
          {enfocada.persona.correo && (
            <a className="ficha-correo" href={`mailto:${enfocada.persona.correo}`}>{enfocada.persona.correo}</a>
          )}
        </div>
      )}
    </div>
  );
}

export default function Constelacion() {
  const t = useTranslations("equipo");
  return (
    <>
      <ul className="leyenda">
        {(Object.keys(NOMBRE_AREA) as AreaId[]).map((id) => (
          <li key={id}><i style={{ background: COLOR[id], boxShadow: `inset 0 0 0 1.5px ${TRAZO[id]}` }} />{t(NOMBRE_AREA[id])}</li>
        ))}
        <li className="leyenda-anillo">
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" style={{ fill: "var(--indigo)" }} />
            <circle cx="11" cy="11" r="9.5" style={{ fill: "none", stroke: "var(--coral)", strokeWidth: 2 }} />
          </svg>
          {t("el_anillo_marca_una_segunda_area")}
        </li>
      </ul>
      <Mapa lienzo={ESCRITORIO} clase="lienzo-ancho" />
      <Mapa lienzo={MOVIL} clase="lienzo-alto" />
    </>
  );
}
