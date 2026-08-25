"use client";

import { useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Articulo } from "@/lib/datos/articulos";
import { useCatalogo } from "@/i18n/catalogo";
import { useEsMovil } from "@/lib/dispositivo-cliente";
import { useCajonDestacados } from "./cajon";

/**
 * Carrusel de artículos destacados. Marcado de index.html:662-671,
 * comportamiento de :2025-2035.
 *
 * Los enlaces ya llevan a alguna parte. En el sitio actual apuntan a
 * #articulo-<slug>, un ancla que no existe (index.html:2027); desde la etapa 6
 * van a /articulos/[slug], que para las piezas de muestra pinta un vacío
 * definido en vez de no hacer nada. El slug lo trae la fila, no se recalcula:
 * es el mismo que la base tiene como único.
 *
 * En teléfono el bloque entero se vuelve un cajón: tapaba la constelación de
 * secciones, así que asoma a la mitad y se saca con el dedo (ver ./cajon.ts).
 */
export default function Carrusel({ articulos }: { articulos: Articulo[] }) {
  const t = useTranslations("carrusel");
  const cat = useCatalogo();
  const zona = useRef<HTMLDivElement>(null);
  const pista = useRef<HTMLDivElement>(null);
  const tirador = useRef<HTMLButtonElement>(null);
  const esMovil = useEsMovil();

  useCajonDestacados(zona, pista, tirador, esMovil);

  const destacados = articulos.filter((a) => a.dest);

  const desplazar = (px: number) =>
    pista.current?.scrollBy({ left: px, behavior: "smooth" });

  return (
    <div className="carrusel-zona" ref={zona}>
      {esMovil && (
        <button className="m-tirador" type="button" ref={tirador} aria-expanded="false">
          <i></i><span className="sr-solo">{t("ver_articulos")}</span>
        </button>
      )}
      <div className="carrusel-cab">
        <p className="ceja">{t("articulos_destacados")}</p>
        <div className="flechas">
          <button
            className="flecha"
            id="cPrev"
            type="button"
            aria-label={t("anterior")}
            onClick={() => desplazar(-320)}
          >←</button>
          <button
            className="flecha"
            id="cSig"
            type="button"
            aria-label={t("siguiente")}
            onClick={() => desplazar(320)}
          >→</button>
        </div>
      </div>
      <div className="carrusel" id="carrusel" ref={pista}>
        {destacados.map((a) => (
          <Link className="tarjeta" key={a.slug} href={`/articulos/${a.slug}`}>
            <span className="tarjeta-sec">{cat.seccion(a.s)}</span>
            <h4>{a.t}</h4>
            <p>{a.a}{" "}·{" "}{a.min}{" "}{t("min_de_lectura")}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
