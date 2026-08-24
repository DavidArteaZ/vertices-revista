import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navegacion";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import { publico } from "@/lib/supabase/publico";
import { slug as claveDe } from "@/lib/texto";
import "./articulo.css";

/**
 * La página de un artículo.
 *
 * Es nueva: en el sitio legado estos enlaces son anclas a un ancla que no
 * existe (index.html:1942). Por eso no está en la compuerta visual —no hay
 * imagen dorada contra la que comparar— y por eso sigue la forma de las
 * páginas satélite, para que se lea como parte de la misma revista.
 *
 * Qué artículos existen aquí lo decide la política `articulos_lectura_publica`
 * y no esta consulta: publicados y piezas de muestra. Un número en borrador da
 * 404 aunque se adivine el slug, y eso es lo que hace que el bucket privado
 * tenga sentido.
 */

type Props = { params: Promise<{ locale: string; slug: string }> };

const EN_FLUJO = { position: "relative", zIndex: 1 } as const;

async function cargaArticulo(slug: string) {
  const sb = publico();

  const { data: articulo } = await sb
    .from("articulos")
    .select("id, titulo, autor, seccion_id, minutos_lectura, slug, pdf_publico_path, es_placeholder, edicion_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!articulo) return null;

  const [{ data: seccion }, { data: relaciones }, { data: edicion }] = await Promise.all([
    sb.from("secciones").select("nombre_display").eq("id", articulo.seccion_id).maybeSingle(),
    sb.from("articulo_temas").select("tema_id").eq("articulo_id", articulo.id),
    articulo.edicion_id
      ? sb.from("ediciones").select("numero, titulo").eq("id", articulo.edicion_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ids = (relaciones ?? []).map((r) => r.tema_id);
  const { data: temas } = ids.length
    ? await sb.from("temas").select("nombre").in("id", ids).order("orden")
    : { data: [] };

  return {
    ...articulo,
    seccion: seccion?.nombre_display ?? "",
    temas: (temas ?? []).map((t) => t.nombre),
    edicion,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const articulo = await cargaArticulo(slug);
  if (!articulo) return { title: "Vértices" };
  return {
    title: `${articulo.titulo} · Vértices`,
    // Las piezas de muestra no deben acabar en un buscador: no son contenido
    // de la revista, son andamio para que el descubrimiento funcione.
    ...(articulo.es_placeholder ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function Pagina({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const articulo = await cargaArticulo(slug);
  if (!articulo) notFound();

  const t = await getTranslations("articulo");
  const catalogo = await getTranslations("secciones");
  const temasT = await getTranslations("temas");

  // El bucket de publicaciones es público a propósito: aquí sólo llega el PDF
  // de una pieza ya publicada, copiado desde el privado al publicar la edición.
  const pdf = articulo.pdf_publico_path
    ? `${process.env.SUPABASE_URL}/storage/v1/object/public/publicaciones/${articulo.pdf_publico_path}`
    : null;

  // Temas y secciones se guardan siempre en español y se traducen al pintar,
  // con la misma clave derivada del literal que usa useCatalogo en el cliente
  // (spec §11). Aquí no puede usarse ese hook porque esto es servidor.
  const traduce = (mensajes: (clave: string) => string, valor: string) =>
    mensajes(claveDe(valor));

  return (
    <>
      <FondoFlujo />
      <Marco satelite style={EN_FLUJO} />

      <main style={EN_FLUJO} className="art-pagina">
        <article className="art-cuerpo">
          <p className="ceja">
            {traduce(catalogo, articulo.seccion)}
            {articulo.minutos_lectura ? ` · ${articulo.minutos_lectura} ${t("min_de_lectura")}` : ""}
          </p>
          <h1>{articulo.titulo}</h1>
          <p className="art-autor">{articulo.autor}</p>

          {articulo.edicion && (
            <p className="art-edicion">
              {t("numero_n", { n: articulo.edicion.numero })} · {articulo.edicion.titulo}
            </p>
          )}

          {pdf ? (
            <p className="art-acciones">
              <a className="boton boton--lleno" href={pdf}>{t("descargar_el_pdf")}</a>
            </p>
          ) : (
            <div className="art-vacio">
              <p>{t("pieza_de_muestra")}</p>
              <p>
                {t("la_convocatoria_esta_abierta")}{" "}
                <Link href="/#envio">{t("enviar_un_manuscrito")}</Link>
              </p>
            </div>
          )}

          {articulo.temas.length > 0 && (
            <div className="art-temas">
              <p className="ceja">{t("temas")}</p>
              <ul>
                {articulo.temas.map((tema) => (
                  <li key={tema}>{traduce(temasT, tema)}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="art-volver">
            <Link href="/">{t("volver_a_la_portada")}</Link>
          </p>
        </article>
      </main>

      <Pie satelite style={EN_FLUJO} />
    </>
  );
}
