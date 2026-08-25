import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import FondoFlujo from "@/components/satelite/FondoFlujo";
import Revelar from "@/components/satelite/Revelar";
import "./lineamientos.css";
import "../movil.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "lineamientos" });
  return { title: t("titulo_documento") };
}

/**
 * Contenido portado de lineamientos.html:269-659, convertido a JSX sin
 * cambiar una sola palabra.
 *
 * EN_FLUJO reproduce lo que fondo-flujo.js hace en tiempo de ejecución:
 * levanta sobre el lienzo del fondo lo que va en el flujo del documento
 * (fondo-flujo.js:9-20). La cabecera ya NO lo lleva: el bucle del original
 * saltaba los elementos con posición propia desde af788e1, y estamparle
 * position:relative era justo lo que despegaba la barra fija del tope de la
 * página en las satélites.
 */
const EN_FLUJO = { position: "relative", zIndex: 1 } as const;

export default async function Pagina({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("lineamientos");

  return (
    <>
      <FondoFlujo />
      <Marco satelite />
      <main style={EN_FLUJO}>
        <p className="ceja">{t("vertices_guia_para_autores")}</p>
        <h1>{t("lineamientos_editoriales")}</h1>
        <div className="entrada">
          <p>{t("antes_de_enviar_tu_pieza_revisa_los_lineamientos_bfc3")}</p>
        </div>
      
        <section id="generales">
          <p className="ceja">{t("para_todas_las_secciones")}</p>
          <h2>{t("lineamientos_generales")}</h2>
          <p className="texto">{t("aplican_a_todas_las_secciones_salvo_que_el_bloqu_1b69")}{" "}<em>{t("rigurosos_en_la_evidencia_amables_en_la_lectura")}</em>{t("toda_pieza_equilibra_sustento_fuentes_metodo_con_bf46")}</p>
          <ul className="generales">
            <li>
              <strong>{t("originalidad")}</strong>
              <p>{t("se_prioriza_el_material_inedito_para_trabajos_es_93f5")}</p>
            </li>
            <li>
              <strong>{t("antiplagio")}</strong>
              <p>{t("toda_pieza_con_datos_citas_o_imagenes_debe_atrib_f9f3")}</p>
            </li>
            <li>
              <strong>{t("uso_de_ia")}</strong>
              <p>{t("se_permite_como_apoyo_en_tareas_especificas_corr_f031")}</p>
            </li>
            <li>
              <strong>{t("equidad_de_genero")}</strong>
              <p>{t("la_revista_busca_en_todo_momento_la_equidad_de_g_0ad5")}</p>
            </li>
            <li>
              <strong>{t("fuentes_y_datos")}</strong>
              <p>{t("todo_dato_lleva_fuente_y_fecha_en_piezas_con_dat_6755")}</p>
            </li>
            <li>
              <strong>{t("metadatos")}</strong>
              <p>{t("cada_pieza_registra_titulo_autoria_filiacion_y_c_7083")}</p>
            </li>
            <li>
              <strong>{t("citacion")}</strong>
              <p>{t("se_adopta_chicago_como_estilo_de_citacion_unico_6843")}</p>
            </li>
          </ul>
        </section>
      
        <section id="niveles">
          <p className="ceja">{t("como_se_revisa")}</p>
          <h2>{t("tres_niveles_de_dictamen")}</h2>
          <div className="niveles">
            <article className="nivel">
              <span className="letra">{t("a")}</span>
              <h3>{t("dictamen_doble_ciego_por_pares")}</h3>
              <p>{t("dos_dictaminadores_evaluan_el_manuscrito_anonimi_56aa")}</p>
              <em>{t("miradas_economicas_y_horizonte_global_cuando_la_3497")}</em>
            </article>
            <article className="nivel">
              <span className="letra">{t("b")}</span>
              <h3>{t("revision_reforzada_y_verificacion_de_datos")}</h3>
              <p>{t("revisor_estudiante_y_revisor_de_datos_o_profesor_a9b5")}</p>
              <em>{t("datanomics_y_horizonte_global_analisis")}</em>
            </article>
            <article className="nivel">
              <span className="letra">{t("c")}</span>
              <h3>{t("edicion_y_verificacion")}</h3>
              <p>{t("se_verifican_datos_consentimientos_y_derechos_de_2b57")}</p>
              <em>{t("apertura_la_voz_de_la_experiencia_sabias_que_cap_e7c2")}</em>
            </article>
          </div>
        </section>
      
        <section id="secciones">
          <p className="ceja">{t("seccion_por_seccion")}</p>
          <h2>{t("criterios_por_seccion")}</h2>
          <p className="texto">{t("cada_bloque_incluye_proposito_autoria_formato_qu_7b36")}</p>
      
          <div className="acordeon">
      
            <details id="datanomics">
              <summary>
                <i style={{ background: 'var(--ambar)' }}></i>
                <h3>{t("1_datanomics")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("publicar_visualizaciones_e_infografias_basadas_e_da69")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("visualizacion_texto_de_200_a_800_palabras_capsul_2e7d")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("visualizaciones_con_fuente_de_datos_explicita_y_f4f7")}</li>
                      <li>{t("comparaciones_claras_tiempo_regiones_grupos_con_8470")}</li>
                      <li>{t("metodologia_breve_de_donde_viene_el_dato_y_como_b172")}</li>
                      <li>{t("recursos_replicables_herramientas_cursos_o_recur_3e95")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("graficas_atractivas_sin_pregunta_economica_ni_co_8d9d")}</li>
                      <li>{t("visualizaciones_sin_fuente_sin_fecha_o_con_datos_d0a8")}</li>
                      <li>{t("interpretacion_fuerte_sin_evidencia")}</li>
                      <li>{t("tutoriales_largos_tipo_manual_tecnico_o_infograf_c7cc")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("fuente_citada_y_fecha_del_dato")}</li>
                  <li>{t("nota_metodologica_de_3_a_4_lineas")}</li>
                  <li>{t("un_hallazgo_principal_legible_en_el_propio_grafi_740d")}</li>
                  <li>{t("ejes_unidades_y_escalas_correctamente_rotulados")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("trazabilidad_del_dato_condicion_de_entrada_corre_18b1")}</p>
                <p className="umbral">{t("no_se_publica_sin_fuente_citada_fecha_y_un_halla_6aa9")}</p>
              </div>
            </details>
      
            <details id="voz">
              <summary>
                <i style={{ background: 'var(--perla)' }}></i>
                <h3>{t("2_la_voz_de_la_experiencia")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("conversar_con_economistas_en_activo_para_aprende_364f")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("entrevista_presencial_extractos_de_100_a_200_pal_d73e")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("consejos_accionables_habilidades_portafolio_entr_cf06")}</li>
                      <li>{t("opiniones_ancladas_en_evidencia_o_experiencia_ve_2a08")}</li>
                      <li>{t("recomendaciones_de_lectura_herramientas_y_decisi_4916")}</li>
                      <li>{t("explicacion_accesible_para_estudiantes_sin_jerga_cee7")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("motivacion_vacia_sin_pasos_concretos")}</li>
                      <li>{t("opinion_politica_o_ideologica_sin_datos_contexto_78a4")}</li>
                      <li>{t("comentarios_de_coyuntura_sin_sustento_o_con_afir_77bf")}</li>
                      <li>{t("promocion_personal_o_de_empresa_sin_valor_inform_0149")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("presentacion_de_la_persona_rol_sector_y_trayecto_8891")}</li>
                  <li>{t("al_menos_3_consejos_o_ideas_accionables")}</li>
                  <li>{t("fuente_cuando_se_citen_datos_o_cifras")}</li>
                  <li>{t("consentimiento_del_entrevistado_sobre_la_publica_6a2c")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("valor_practico_anclaje_en_evidencia_o_experienci_1666")}</p>
                <p className="umbral">{t("no_se_publica_si_es_motivacion_generica_sin_paso_564f")}</p>
              </div>
            </details>
      
            <details id="miradas">
              <summary>
                <i style={{ background: 'var(--coral)' }}></i>
                <h3>{t("3_miradas_economicas")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("difundir_investigaciones_economicas_breves_para_492a")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("paper_breve_de_hasta_5_cuartillas_aprox_2_000_a_27ae")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("investigacion_original_con_metodologia_cualitati_c2d5")}</li>
                      <li>{t("estudios_de_caso_modelos_economicos_y_analisis_d_42cb")}</li>
                      <li>{t("evidencias_finales_de_materias_y_trabajos_de_equ_a20f")}</li>
                      <li>{t("temas_actuales_inflacion_empleo_desigualdad_crec_23f9")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("opiniones_sin_sustento_academico")}</li>
                      <li>{t("ensayos_puramente_reflexivos_o_narrativos")}</li>
                      <li>{t("divulgacion_general_sin_metodologia_ni_referenci_8239")}</li>
                      <li>{t("lenguaje_excesivamente_tecnico_sin_explicacion")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("pregunta_de_investigacion_explicita")}</li>
                  <li>{t("marco_teorico_breve_y_metodologia_identificable")}</li>
                  <li>{t("hallazgo_principal_implicacion_y_limitaciones_de_f047")}</li>
                  <li>{t("referencias_completas_y_qr_funcional_al_paper_in_3f6a")}</li>
                  <li>{t("extension_dentro_de_las_5_cuartillas_etiqueta_de_d377")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("con_la_rubrica_del_dictamen_maestro_relevancia_c_518a")}</p>
                <p className="umbral">{t("no_se_acepta_con_puntaje_menor_a_2_en_rigor_conc_1ea1")}</p>
              </div>
            </details>
      
            <details id="horizonte">
              <summary>
                <i style={{ background: 'var(--pizarra)' }}></i>
                <h3>{t("4_horizonte_global")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("traducir_la_economia_internacional_a_un_lenguaje_fd03")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("analisis_explicativo_aplicado_y_accesible_de_800_0234")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("temas_que_inviten_a_cuestionar_lo_aprendido_en_c_08d8")}</li>
                      <li>{t("papers_y_ensayos_que_expliquen_como_lo_que_pasa_5785")}</li>
                      <li>{t("ideas_nuevas_o_innovadoras_sobre_la_perspectiva_efc3")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("resumen_de_lo_que_ya_salio_en_las_noticias")}</li>
                      <li>{t("lenguaje_excesivamente_tecnico_si_un_alumno_de_p_c5f6")}</li>
                      <li>{t("afirmaciones_sin_canales_de_transmision_ni_evide_ad69")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("hecho_detonante_y_por_que_importa_para_mexico")}</li>
                  <li>{t("pregunta_guia_y_un_marco_conceptual_simple_conce_77e9")}</li>
                  <li>{t("canales_de_transmision_del_fenomeno_hacia_la_eco_ef14")}</li>
                  <li>{t("graficas_con_fuente_y_fecha_implicaciones_y_cier_20fc")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("aplicacion_conceptual_aplica_teoria_no_resume_no_1d63")}</p>
                <p className="umbral">{t("no_se_publica_si_es_solo_resumen_de_coyuntura_si_a5cb")}</p>
              </div>
            </details>
      
            <details id="sabias">
              <summary>
                <i style={{ background: 'var(--indigo)' }}></i>
                <h3>{t("5_sabias_que")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("compartir_datos_curiosos_hechos_relevantes_y_hal_a959")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("capsula_breve_de_100_a_200_palabras_visualmente_1ffc")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("datos_curiosos_sobre_conceptos_o_fenomenos_econo_2029")}</li>
                      <li>{t("hechos_interesantes_de_la_historia_economica")}</li>
                      <li>{t("curiosidades_sobre_economistas_y_sus_aportacione_c9e5")}</li>
                      <li>{t("explicaciones_breves_de_eventos_economicos_actua_3944")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("contenido_excesivamente_tecnico_para_el_formato_8e0a")}</li>
                      <li>{t("explicaciones_extensas_que_rompen_el_caracter_de_98dc")}</li>
                      <li>{t("datos_desactualizados_o_fuera_de_contexto")}</li>
                      <li>{t("temas_no_relacionados_con_la_economia")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("fuente_verificable_del_dato_registrada_aunque_no_05ec")}</li>
                  <li>{t("contexto_y_fecha_cuando_sea_pertinente")}</li>
                  <li>{t("un_gancho_claro_que_motive_la_lectura")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("veracidad_y_verificabilidad_del_dato_condicion_d_74cf")}</p>
                <p className="umbral">{t("no_se_publica_si_el_dato_no_es_verificable_o_est_f8f2")}</p>
              </div>
            </details>
      
            <details id="capital">
              <summary>
                <i style={{ background: 'var(--perla)' }}></i>
                <h3>{t("6_capital_social")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("documentar_y_fortalecer_la_identidad_de_la_comun_63c4")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("cronica_de_tono_cercano_y_documentado_de_500_a_9_0519")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("relatos_en_primera_persona_sobre_la_vida_en_la_f_f1cd")}</li>
                      <li>{t("contenido_visual_que_acompane_las_cronicas_de_ev_befd")}</li>
                      <li>{t("metodos_y_tips_de_estudio_para_las_materias_de_e_808d")}</li>
                      <li>{t("charlas_con_profesores_destacados_o_alumnos_con_0ed0")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("criticas_destructivas_hacia_la_institucion_o_los_0898")}</li>
                      <li>{t("lenguaje_informal_excesivo_se_mantiene_el_decoro_2e3a")}</li>
                      <li>{t("contenido_sin_conexion_con_la_facultad_o_la_econ_c61c")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("que_evento_o_experiencia_se_relata_y_por_que_imp_e8fc")}</li>
                  <li>{t("2_a_4_fotos_con_pie_de_foto_que_quien_fecha_y_lu_ab1b")}</li>
                  <li>{t("revision_previa_de_imagenes_por_el_equipo_de_fot_2cca")}</li>
                  <li>{t("consentimiento_de_las_personas_fotografiadas")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("valor_comunitario_precision_factual_fechas_nombr_33c8")}</p>
                <p className="umbral">{t("no_se_publica_con_criticas_destructivas_ni_con_f_956a")}</p>
              </div>
            </details>
      
            <details id="excelencia">
              <summary>
                <i style={{ background: 'var(--coral)' }}></i>
                <h3>{t("7_excelencia_en_accion")}</h3>
                <span className="flecha"></span>
              </summary>
              <div className="cuerpo-sec">
                <p className="dato"><strong>{t("proposito")}</strong>{" "}{t("reconocer_y_visibilizar_los_logros_academicos_y_1521")}</p>
                <p className="dato"><strong>{t("formato_y_extension")}</strong>{" "}{t("capsula_de_reconocimiento_foto_nombre_semestre_c_08d7")}</p>
                <div className="dos-col">
                  <div className="si">
                    <h4>{t("que_si_entra")}</h4>
                    <ul>
                      <li>{t("logros_academicos_premios_becas_publicaciones_co_b849")}</li>
                      <li>{t("reconocimientos_institucionales_o_externos_y_par_ffa5")}</li>
                      <li>{t("investigaciones_que_lograron_publicarse")}</li>
                      <li>{t("meritos_profesionales_relacionados_con_el_ambito_16a6")}</li>
                    </ul>
                  </div>
                  <div className="no">
                    <h4>{t("que_no_entra")}</h4>
                    <ul>
                      <li>{t("logros_no_relacionados_con_el_ambito_academico_o_c9cd")}</li>
                      <li>{t("contenido_sin_informacion_suficiente_o_verificab_8445")}</li>
                    </ul>
                  </div>
                </div>
                <p className="dato"><strong>{t("requisitos_obligatorios")}</strong></p>
                <ul>
                  <li>{t("evidencia_del_logro_documento_enlace_o_constanci_bde4")}</li>
                  <li>{t("fotografia_proporcionada_por_la_persona_con_su_c_b2f2")}</li>
                  <li>{t("datos_correctos_nombre_semestre_o_cargo_vinculo_6a60")}</li>
                </ul>
                <p className="dato" style={{ marginTop: '14px' }}><strong>{t("como_se_evalua")}</strong>{" "}{t("verificabilidad_del_logro_condicion_de_entrada_p_85ad")}</p>
                <p className="umbral">{t("no_se_publica_sin_evidencia_del_logro_ni_consent_990f")}</p>
              </div>
            </details>
      
          </div>
        </section>
      
        <section id="matriz">
              <h2>{t("las_secciones_de_un_vistazo")}</h2>
          <div className="tabla-scroll">
            <table className="matriz">
              <thead>
                <tr><th>{t("seccion")}</th><th>{t("como_se_revisa_6d7b")}</th><th>{t("extension_sugerida")}</th></tr>
              </thead>
              <tbody>
                <tr><td>{t("1_datanomics")}</td><td>{t("b_reforzada_datos")}</td><td>{t("200_a_800_palabras_1_a_3_graficas")}</td></tr>
                <tr><td>{t("2_la_voz_de_la_experiencia")}</td><td>{t("c_editorial_fact_check")}</td><td>{t("extractos_de_100_a_200_palabras")}</td></tr>
                <tr><td>{t("3_miradas_economicas")}</td><td>{t("a_doble_ciego_por_pares")}</td><td>{t("hasta_5_cuartillas_qr")}</td></tr>
                <tr><td>{t("4_horizonte_global")}</td><td>{t("b_a_si_es_paper")}</td><td>{t("800_a_1500_palabras")}</td></tr>
                <tr><td>{t("5_sabias_que")}</td><td>{t("c_fact_check")}</td><td>{t("100_a_200_palabras")}</td></tr>
                <tr><td>{t("6_capital_social")}</td><td>{t("c_editorial_imagen")}</td><td>{t("500_a_900_palabras_fotos")}</td></tr>
                <tr><td>{t("7_excelencia_en_accion")}</td><td>{t("c_verificacion_del_logro")}</td><td>{t("capsula_foto_texto")}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      
        <div className="cierre">
          <p>{t("tu_pieza_ya_cumple_con_su_seccion_el_asistente_d_609a")}</p>
          <a className="boton boton--lleno" href="index.html#envio">{t("publica_tu_articulo")}</a>
        </div>
      </main>      <Pie satelite style={EN_FLUJO} />
      <Revelar />
    </>
  );
}
