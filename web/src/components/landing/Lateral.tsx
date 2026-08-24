"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/** Lineamientos para autores y preguntas frecuentes. index.html:866-898. */
export default function Lateral() {
  const t = useTranslations("lateral");
  return (
    <aside className="lateral">
      <div className="lineamientos" id="lineamientos">
        <h3>{t("lineamientos_para_autores")}</h3>
        <ul>
          <li>{t("se_reciben_papers_y_abstracts_de_investigacion_a_e2b9")}</li>
          <li>{t("formato_docx_o_pdf_interlineado_1_5_y_letra_time_f362")}</li>
          <li>{t("citacion_en_estilo_chicago_todo_dato_y_toda_graf_3036")}</li>
          <li>{t("las_piezas_de_investigacion_suman_resumen_y_de_3_44bf")}</li>
          <li>{t("el_uso_de_inteligencia_artificial_se_declara")}</li>
          <li>{t("decisiones_posibles_aceptado_revisiones_menores_c91a")}</li>
        </ul>
        <p className="linea-completa"><Link href="/lineamientos">{t("consulta_los_lineamientos_completos_por_seccion")}</Link></p>
      </div>
      <div>
        <h3>{t("preguntas_frecuentes")}</h3>
        <details>
          <summary>{t("quien_puede_publicar")}</summary>
          <p>{t("quien_sea_la_convocatoria_es_abierta_puede_publi_99fd")}</p>
        </details>
        <details>
          <summary>{t("como_se_revisa_mi_trabajo")}</summary>
          <p>{t("segun_el_tipo_de_pieza_la_investigacion_pasa_por_f7f7")}</p>
        </details>
        <details>
          <summary>{t("puedo_escribir_desde_fuera_del_tec_o_en_otro_idi_7141")}</summary>
          <p>{t("si_la_revista_nace_en_el_tec_de_monterrey_ccm_pe_abfc")}</p>
        </details>
        <details>
          <summary>{t("puedo_proponer_un_tema_nuevo")}</summary>
          <p>{t("si_los_27_temas_de_la_constelacion_son_un_mapa_n_30c2")}</p>
        </details>
      </div>
    </aside>
  );
}
