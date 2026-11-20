import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navegacion";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import { publico } from "@/lib/supabase/publico";
import "../articulos/[slug]/articulo.css";
import "./[numero]/edicion.css";
import "../movil.css";

/**
 * La lista de números publicados, cada uno hacia /ediciones/<número>.
 *
 * Qué números aparecen lo decide `ediciones_lectura_publica` (sólo los
 * publicados): un borrador no sale aquí aunque exista en el panel.
 */

type Props = { params: Promise<{ locale: string }> };

const EN_FLUJO = { position: "relative", zIndex: 1 } as const;

// Sin esto se hornearía al compilar (el layout genera los idiomas) y un número
// recién publicado no aparecería hasta el siguiente despliegue.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ediciones · Vértices" };

export default async function Pagina({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("ediciones");

  const { data, error } = await publico()
    .from("ediciones")
    .select("id, numero, titulo")
    .order("numero", { ascending: false });

  if (error) console.error(JSON.stringify({ evento: "ediciones_publicas_fallo", error: error.message }));
  const ediciones = data ?? [];

  return (
    <>
      <FondoFlujo />
      <Marco satelite />

      <main style={EN_FLUJO} className="art-pagina">
        <article className="art-cuerpo">
          <p className="ceja">{t("la_revista")}</p>
          <h1>{t("ediciones")}</h1>

          {ediciones.length === 0 ? (
            <div className="art-vacio">
              <p>{t("todavia_no_hay_ediciones_publicadas")}</p>
            </div>
          ) : (
            <div className="ed-piezas">
              <ul>
                {ediciones.map((e) => (
                  <li key={e.id}>
                    <Link href={`/ediciones/${e.numero}`}>
                      <span className="ed-autor">{t("numero_n", { n: e.numero })}</span>
                      <span className="ed-titulo">{e.titulo}</span>
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
