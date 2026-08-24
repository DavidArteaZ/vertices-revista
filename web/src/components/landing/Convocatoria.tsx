"use client";

import { useTranslations } from "next-intl";

/** Sección de convocatoria. Marcado de index.html:697-712. Estático. */
export default function Convocatoria() {
  const t = useTranslations("convocatoria");
  return (
    <section className="portal-seccion portal-intro" id="convocatoria">
      <p className="ceja">{t("convocatoria_abierta")}</p>
      <h2 className="titulo">{t("publica_en")}{" "}<em>{t("vertices")}</em></h2>
      <p className="bajada">{t("vertices_es_la_revista_academica_de_economia_cre_388b")}</p>
      <ul className="cifras">
        <li><strong>27</strong><span>{t("temas")}</span></li>
        <li><strong>8</strong><span>{t("secciones")}</span></li>
        <li><strong>4</strong><span>{t("formatos_de_pieza")}</span></li>
      </ul>
      <ol className="pasos">
        <li><h3>{t("prepara_tu_pieza")}</h3><p>{t("elige_formato_y_seccion_revisa_los_lineamientos_0d06")}</p></li>
        <li><h3>{t("enviala_por_el_portal")}</h3><p>{t("completa_el_formulario_con_tus_datos_el_resumen_5f32")}</p></li>
        <li><h3>{t("dictaminacion_doble_ciego")}</h3><p>{t("dos_revisores_evaluan_tu_texto_sin_conocer_tu_id_5d0e")}</p></li>
        <li><h3>{t("publicacion")}</h3><p>{t("tu_pieza_aparece_en_la_siguiente_edicion_en_pdf_4f09")}</p></li>
      </ol>
    </section>
  );
}
