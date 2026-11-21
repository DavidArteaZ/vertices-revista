import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navegacion";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import { publico } from "@/lib/supabase/publico";
import { slug as claveDe } from "@/lib/texto";
import "../../articulos/[slug]/articulo.css";
import "./edicion.css";
import "../../movil.css";

/**
 * La página de un número: su PDF de edición final y sus piezas por sección.
 *
 * Igual que la de un artículo, qué números existen aquí lo decide la política
 * `ediciones_lectura_publica` (sólo los publicados), no esta consulta: un
 * número en borrador da 404 aunque se adivine la dirección. Reutiliza la hoja
 * de la página de artículo para leerse como parte de la misma revista; los
 * enlaces de cada pieza siguen siendo los de siempre, /articulos/<slug>.
 */

type Props = { params: Promise<{ locale: string; numero: string }> };

const EN_FLUJO = { position: "relative", zIndex: 1 } as const;

async function cargaEdicion(numero: number) {
  if (!Number.isInteger(numero) || numero <= 0) return null;
  const sb = publico();

  const { data: edicion, error } = await sb
    .from("ediciones")
    .select("id, numero, titulo, pdf_final_path")
    .eq("numero", numero)
    .maybeSingle();

  if (error) console.error(JSON.stringify({ evento: "edicion_publica_fallo", numero, error: error.message }));
  if (!edicion) return null;

  const [articulos, piezas, secciones] = await Promise.all([
    sb
      .from("articulos")
      .select("id, titulo, autor, slug, seccion_id")
      .eq("edicion_id", edicion.id)
      .order("orden", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
    sb.from("edicion_piezas").select("id, titulo, seccion_id").eq("edicion_id", edicion.id).order("id"),
    sb.from("secciones").select("id, nombre_display, orden").order("orden"),
  ]);

  for (const [que, r] of [["articulos", articulos], ["piezas", piezas], ["secciones", secciones]] as const) {
    if (r.error) console.error(JSON.stringify({ evento: "edicion_publica_fallo", que, numero, error: r.error.message }));
  }

  // Una lista por sección, en el orden de la revista; las secciones vacías no
  // se enseñan. Los artículos enlazan a su página de siempre; las piezas por
  // título no tienen página propia y van sin enlace.
  const porSeccion = (secciones.data ?? [])
    .map((s) => ({
      ...s,
      articulos: (articulos.data ?? []).filter((a) => a.seccion_id === s.id),
      piezas: (piezas.data ?? []).filter((p) => p.seccion_id === s.id),
    }))
    .filter((s) => s.articulos.length + s.piezas.length > 0);

  return { ...edicion, porSeccion };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { numero } = await params;
  const edicion = await cargaEdicion(Number(numero));
  if (!edicion) return { title: "Vértices" };
  return { title: `${edicion.titulo} · Vértices` };
}

export default async function Pagina({ params }: Props) {
  const { locale, numero } = await params;
  setRequestLocale(locale);

  const edicion = await cargaEdicion(Number(numero));
  if (!edicion) notFound();

  const t = await getTranslations("edicion");
  const catalogo = await getTranslations("secciones");

  const pdf = edicion.pdf_final_path
    ? `${process.env.SUPABASE_URL}/storage/v1/object/public/publicaciones/${edicion.pdf_final_path}`
    : null;

  return (
    <>
      <FondoFlujo />
      <Marco satelite />

      <main style={EN_FLUJO} className="art-pagina">
        <article className="art-cuerpo ed-cuerpo">
          <p className="ceja">{t("numero_n", { n: edicion.numero })}</p>
          <h1>{edicion.titulo}</h1>

          {pdf && (
            <>
              <p className="art-acciones">
                <a className="boton boton--lleno" href={pdf} target="_blank" rel="noopener noreferrer">
                  {t("abrir_el_pdf")}
                </a>{" "}
                <a className="boton" href={pdf} download>
                  {t("descargar_el_pdf")}
                </a>
              </p>
              <object className="ed-visor" data={pdf} type="application/pdf" aria-label={t("la_edicion_completa")}>
                <p className="ed-sin-visor">{t("tu_navegador_no_muestra_el_pdf_aqui_abrelo_o_des_75ed")}</p>
              </object>
            </>
          )}

          {edicion.porSeccion.length > 0 && (
            <div className="ed-piezas">
              <p className="ceja">{t("en_este_numero")}</p>
              {edicion.porSeccion.map((s) => (
                <section key={s.id} className="ed-seccion">
                  <h2>{catalogo(claveDe(s.nombre_display))}</h2>
                  <ul>
                    {s.articulos.map((a) => (
                      <li key={`a${a.id}`}>
                        <Link href={`/articulos/${a.slug}`}>
                          <span className="ed-titulo">{a.titulo}</span>
                          <span className="ed-autor">{a.autor}</span>
                        </Link>
                      </li>
                    ))}
                    {s.piezas.map((p) => (
                      <li key={`p${p.id}`} className="ed-sin-enlace">
                        <span className="ed-titulo">{p.titulo}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
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
