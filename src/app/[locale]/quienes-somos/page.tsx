import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import Revelar from "@/components/satelite/Revelar";
import "./quienes-somos.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quienessomos" });
  return { title: t("titulo_documento") };
}

/**
 * Contenido portado de quienes-somos.html:240-335, convertido a JSX sin
 * cambiar una sola palabra.
 *
 * EN_FLUJO reproduce lo que fondo-flujo.js hace en tiempo de ejecución:
 * recorre document.body.children y estampa position:relative; z-index:1 en
 * línea sobre cada hermano (fondo-flujo.js:9-20). Eso incluye la cabecera,
 * que por tanto NO queda fija en las páginas satélite aunque el CSS diga
 * position:fixed. Casi seguro no era la intención del autor, pero es el
 * comportamiento vigente y está en las imágenes doradas: cambiarlo sería
 * rediseñar.
 */
const EN_FLUJO = { position: "relative", zIndex: 1 } as const;

export default async function Pagina({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("quienessomos");

  return (
    <>
      <FondoFlujo />
      <Marco satelite style={EN_FLUJO} />
      <main style={EN_FLUJO}>
        <div className="hero-qs">
          <div className="hero-cont">
            <p className="ceja">{t("vertices_revista_academica_de_economia")}</p>
            <h1>{t("acerca_de")}</h1>
            <p className="qs-lema">{t("el_punto_donde_las_ideas_se_conectan")}</p>
            <div className="entrada">
              <p>{t("vertices_es_la_revista_estudiantil_de_economia_d_54c4")}{" "}<em>{t("de_economistas_para_economistas")}</em>{t("rigurosa_en_la_evidencia_y_amable_en_la_lectura")}</p>
              <p>{t("somos_un_espacio_de_encuentro_y_convergencia_de_8b80")}</p>
            </div>
          </div>
        </div>
      
      
        <section id="mision">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--indigo)' }}></i>{t("mision")}</p>
          <h2>{t("el_punto_de_encuentro_del_rigor_y_las_ideas")}</h2>
          <p className="texto">{t("ser_el_punto_de_encuentro_y_convergencia_de_idea_9c89")}</p>
        </section>
      
      
        <section id="vision">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--perla)' }}></i>{t("vision")}</p>
          <h2>{t("la_revista_de_economia_referente_a_nivel_univers_c9bd")}</h2>
          <p className="texto">{t("consolidarnos_como_la_revista_estudiantil_de_eco_1c57")}</p>
        </section>
      
      
        <section id="valores">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--ambar)' }}></i>{t("valores")}</p>
          <h2>{t("los_valores_que_compartimos_con_el_tec")}</h2>
          <p className="texto">{t("como_proyecto_de_la_comunidad_del_tecnologico_de_4dae")}</p>
          <div className="valores">
            <article className="valor">
              <i style={{ background: 'var(--indigo)' }}></i>
              <h3>{t("innovacion")}</h3>
              <p>{t("nos_apasiona_la_disrupcion_que_genera_valor_busc_f317")}</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--perla)' }}></i>
              <h3>{t("integridad")}</h3>
              <p>{t("ejercemos_la_libertad_con_responsabilidad_cada_a_afaf")}</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--pizarra)' }}></i>
              <h3>{t("colaboracion")}</h3>
              <p>{t("juntos_alcanzamos_la_vision_la_revista_es_obra_d_b168")}</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--coral)' }}></i>
              <h3>{t("empatia_e_inclusion")}</h3>
              <p>{t("ponemos_siempre_en_primer_lugar_a_las_personas_e_8d06")}</p>
            </article>
            <article className="valor">
              <i style={{ background: 'var(--ambar)' }}></i>
              <h3>{t("ciudadania_global")}</h3>
              <p>{t("trabajamos_por_un_mundo_sostenible_conectamos_lo_7c95")}</p>
            </article>
          </div>
          <p className="fuente-nota">{t("valores_institucionales_del")}{" "}<a href="https://tec.mx/es/conocenos/principios-valores-y-vision" target="_blank" rel="noopener">{t("tecnologico_de_monterrey")}</a>.</p>
        </section>
      
      
        <section id="integridad">
          <p className="ceja"><i className="nodo" style={{ background: 'var(--coral)' }}></i>{t("integridad_academica")}</p>
          <h2>{t("como_cuidamos_el_rigor_de_lo_que_publicamos")}</h2>
          <ul className="integridad">
            <li>
              <strong>{t("dictaminacion")}</strong>
              <p>{t("tres_niveles_de_revision_segun_el_tipo_de_pieza_4de8")}</p>
            </li>
            <li>
              <strong>{t("antiplagio")}</strong>
              <p>{t("los_trabajos_de_investigacion_pasan_por_una_veri_375b")}</p>
            </li>
            <li>
              <strong>{t("fuentes_y_datos")}</strong>
              <p>{t("todo_dato_lleva_fuente_y_fecha_las_piezas_con_da_1d5e")}</p>
            </li>
            <li>
              <strong>{t("uso_de_ia")}</strong>
              <p>{t("las_herramientas_de_inteligencia_artificial_se_p_dfef")}</p>
            </li>
            <li>
              <strong>{t("equidad_de_genero")}</strong>
              <p>{t("buscamos_de_manera_activa_la_participacion_homog_acb4")}</p>
            </li>
          </ul>
          <p className="fuente-nota">{t("el_detalle_completo_vive_en_los")}{" "}<a href="lineamientos.html">{t("lineamientos_editoriales")}</a>.</p>
        </section>
      
        <div className="cierre">
          <p>{t("la_convocatoria_esta_abierta_estudiantes_de_econ_094a")}</p>
          <a className="boton boton--lleno" href="index.html#envio">{t("publica_tu_articulo")}</a>
        </div>
      </main>      <Pie satelite style={EN_FLUJO} />
      <Revelar />
    </>
  );
}
