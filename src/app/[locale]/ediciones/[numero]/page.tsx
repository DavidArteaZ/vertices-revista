import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navegacion";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import { publico } from "@/lib/supabase/publico";
import "../../articulos/[slug]/articulo.css";
import "./edicion.css";
import "../../movil.css";

/**
 * La página de un número: su PDF de edición final y la lista de sus piezas.
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

  const { data: articulos, error: eArticulos } = await sb
    .from("articulos")
    .select("id, titulo, autor, slug")
    .eq("edicion_id", edicion.id)
    .order("orden", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (eArticulos) {
    console.error(JSON.stringify({ evento: "edicion_publica_articulos_fallo", numero, error: eArticulos.message }));
  }

  return { ...edicion, articulos: articulos ?? [] };
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

          {edicion.articulos.length > 0 && (
            <div className="ed-piezas">
              <p className="ceja">{t("en_este_numero")}</p>
              <ul>
                {edicion.articulos.map((a) => (
                  <li key={a.id}>
                    <Link href={`/articulos/${a.slug}`}>
                      <span className="ed-titulo">{a.titulo}</span>
                      <span className="ed-autor">{a.autor}</span>
                    </Link>
                  </li>
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
