"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCatalogo } from "@/i18n/catalogo";
import { TOPICS } from "@/lib/datos/temas";
import { GENEROS_ENVIO, SECCIONES_ENVIO, type RolArchivo } from "@/lib/datos/portal-envios";
import { enviarManuscrito, esError, type ArchivoEnvio, type Progreso } from "@/lib/cliente/enviar";
import CamposArchivosEnvio from "./CamposArchivosEnvio";
import {
  validarPaso,
  vacio,
  IMAGEN_OK,
  PDF_OK,
  MAX_BYTES,
  AVISO,
  type Aviso,
  type CamposSeccion,
  type DatosEnvio,
} from "@/lib/validacion";

const PASOS = ["autoria", "pieza", "archivos", "declaracion"] as const;

const ERRORES_PORTAL: Record<string, [string, string]> = {
  portal_genero_requerido: ["Elige una opción de género.", "Choose a gender option."],
  portal_datanomics_texto_200_800: ["El texto explicativo debe tener entre 200 y 800 palabras.", "The explanatory text must contain 200 to 800 words."],
  portal_datanomics_visualizacion_1_3: ["Adjunta de 1 a 3 imágenes para la visualización.", "Attach 1 to 3 images for the visualization."],
  portal_repositorio_url: ["Escribe un enlace válido para el repositorio.", "Enter a valid repository link."],
  portal_semblanza_requerida: ["Completa la semblanza.", "Complete the profile."],
  portal_modalidad_requerida: ["Elige la modalidad de entrevista.", "Choose the interview format."],
  portal_foto_requerida: ["Adjunta la foto solicitada.", "Attach the requested photo."],
  portal_cesion_requerida: ["Adjunta la cesión de derechos de imagen firmada en PDF.", "Attach the signed image rights release as a PDF."],
  portal_miradas_resumen_100_300: ["El resumen debe tener entre 100 y 300 palabras.", "The abstract must contain 100 to 300 words."],
  portal_miradas_paper_requerido: ["Adjunta el paper en PDF.", "Attach the paper as a PDF."],
  portal_miradas_anexos_max_3: ["Puedes adjuntar como máximo 3 anexos.", "You can attach up to 3 appendices."],
  portal_horizonte_resumen_max_200: ["El resumen debe tener entre 1 y 200 palabras.", "The summary must contain 1 to 200 words."],
  portal_horizonte_articulo_requerido: ["Adjunta el artículo en PDF.", "Attach the article as a PDF."],
  portal_sabias_dato_max_200: ["El dato debe tener entre 1 y 200 palabras.", "The fact must contain 1 to 200 words."],
  portal_sabias_imagen_max_1: ["Puedes adjuntar como máximo una imagen.", "You can attach at most one image."],
  portal_capital_cronica_500_900: ["La crónica debe tener entre 500 y 900 palabras.", "The chronicle must contain 500 to 900 words."],
  portal_capital_fotos_1_4: ["Adjunta de 1 a 4 fotos.", "Attach 1 to 4 photos."],
  portal_capital_pies_requeridos: ["Escribe los pies de imagen en orden, separados por coma.", "Enter the image captions in order, separated by commas."],
  portal_excelencia_cronica_requerida: ["Completa la crónica.", "Complete the chronicle."],
  portal_archivo_tipo: ["El tipo de archivo no corresponde con este campo.", "The file type does not match this field."],
};

export default function FormularioEnvio() {
  const t = useTranslations("formularioenvio");
  const tAviso = useTranslations("avisos");
  const locale = useLocale();
  const { tema, seccion: nombreSeccion } = useCatalogo();
  const es = locale === "es";
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosEnvio>(vacio);
  const [archivos, setArchivos] = useState<ArchivoEnvio[]>([]);
  const [error, setError] = useState<Aviso | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Progreso | null>(null);

  const set = <K extends keyof DatosEnvio>(k: K, val: DatosEnvio[K]) =>
    setDatos((d) => ({ ...d, [k]: val }));

  const setCampo = <K extends keyof CamposSeccion>(k: K, val: CamposSeccion[K]) =>
    setDatos((d) => ({ ...d, campos: { ...d.campos, [k]: val } }));

  function cambiarSeccion(valor: string) {
    setDatos((d) => ({ ...d, seccion: valor, campos: { ...vacio.campos } }));
    setArchivos([]);
    setError(null);
  }

  function ponerArchivos(rol: RolArchivo, nuevos: File[], maximo: number) {
    const esImagen = rol === "foto" || rol === "visualizacion";
    const validos: File[] = [];
    for (const archivo of nuevos.slice(0, maximo)) {
      if (!(esImagen ? IMAGEN_OK : PDF_OK).test(archivo.name)) {
        setError({ clave: "portal_archivo_tipo" });
        return;
      }
      if (archivo.size > MAX_BYTES) {
        setError({ clave: AVISO.peso, valores: { a: archivo.name } });
        return;
      }
      validos.push(archivo);
    }
    setArchivos((actuales) => [
      ...actuales.filter((x) => x.rol !== rol),
      ...validos.map((archivo) => ({ archivo, rol })),
    ]);
    setError(null);
  }

  async function continuar() {
    if (enviando) return;
    const lista = archivos.map(({ archivo, rol }) => ({ name: archivo.name, size: archivo.size, rol }));
    const err = validarPaso(paso, datos, lista);
    if (err) { setError(err); return; }
    if (paso < 3) { setPaso(paso + 1); setError(null); return; }

    setError(null);
    const resultado = await enviarManuscrito(datos, archivos, locale, setEnviando);
    setEnviando(null);
    if (esError(resultado)) { setError(resultado.error); return; }
    setFolio(resultado.folio);
  }

  function otroEnvio() {
    setDatos({ ...vacio, campos: { ...vacio.campos } });
    setArchivos([]);
    setPaso(0);
    setError(null);
    setFolio(null);
  }

  function textoError(a: Aviso): string {
    const local = ERRORES_PORTAL[a.clave];
    if (local) return local[es ? 0 : 1];
    return tAviso(a.clave, a.valores);
  }

  const etiquetasPaso = es
    ? ["Autoría", "Información de la pieza", "Archivos", "Declaración"]
    : ["Authorship", "Piece information", "Files", "Declaration"];

  if (folio) {
    return (
      <div id="confirmacion">
        <p className="ceja">{t("envio_registrado")}</p>
        <h3>{t("gracias_por_confiar_en_vertices")}</h3>
        <p>{t("tu_manuscrito_quedo_registrado_con_el_folio")} <strong id="folio">{folio}</strong>{t("guardalo_con_el_y_tu_correo_puedes_consultar_el_e92d")} <a href="#estado" data-ir="estado">{t("estado_de_tu_envio")}</a>{t("tu_pieza_entrara_al_proceso_de_dictaminacion_de_79ea")}</p>
        <p className="ayuda">{t("te_escribimos_un_acuse_a_tu_correo")}</p>
        <dl>
          <dt>{t("titulo")}</dt><dd>{datos.titulo}</dd>
          <dt>{t("autoria")}</dt><dd>{datos.nombre}{datos.coautores ? `, ${datos.coautores}` : ""}</dd>
          <dt>{t("seccion")}</dt><dd>{nombreSeccion(datos.seccion)}</dd>
          <dt>{t("tema_principal")}</dt><dd>{tema(datos.tema)}</dd>
        </dl>
        <button type="button" className="boton" onClick={otroEnvio}>{t("enviar_otro_manuscrito")}</button>
      </div>
    );
  }

  return (
    <form id="formulario" noValidate onSubmit={(e) => e.preventDefault()}>
      <ol className="wiz-pasos" id="wizPasos">
        {PASOS.map((p, k) => (
          <li key={p} className={k === paso ? "activo" : k < paso ? "hecho" : undefined} data-paso={k} onClick={() => { if (k < paso) { setPaso(k); setError(null); } }}>
            <i>{k + 1}</i>{etiquetasPaso[k]}
          </li>
        ))}
      </ol>

      <fieldset className={`paso${paso === 0 ? " activo" : ""}`} data-paso="0">
        <legend>{t("datos_de_autoria")}</legend>
        <div className="campo">
          <label htmlFor="nombre">{t("nombre_completo")}</label>
          <input type="text" id="nombre" autoComplete="name" value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </div>
        <div className="fila2 campo">
          <div>
            <label htmlFor="correo">{t("correo_de_contacto")}</label>
            <input type="email" id="correo" placeholder={t("tucorreo_ejemplo_com")} autoComplete="email" value={datos.correo} onChange={(e) => set("correo", e.target.value)} />
          </div>
          <div>
            <label htmlFor="perfil">{t("perfil_de_autor")}</label>
            <select id="perfil" value={datos.perfil} onChange={(e) => set("perfil", e.target.value)}>
              <option value="">{t("elige_tu_perfil")}</option>
              <option value="Estudiante de licenciatura en Economía">{t("estudiante_de_licenciatura_en_economia")}</option>
              <option value="Estudiante de otra licenciatura">{t("estudiante_de_otra_licenciatura")}</option>
              <option value="Economista titulado (licenciatura, maestría o doctorado)">{t("economista_titulado_licenciatura_maestria_o_doct_baa0")}</option>
              <option value="Científico(a) de datos">{t("cientifico_a_de_datos")}</option>
              <option value="Científico(a) social">{t("cientifico_a_social")}</option>
              <option value="Otro perfil interesado en la economía">{t("otro_perfil_interesado_en_la_economia")}</option>
            </select>
          </div>
        </div>
        <div className="fila2 campo">
          <div>
            <label htmlFor="afiliacion">{t("institucion_o_afiliacion")}</label>
            <input type="text" id="afiliacion" placeholder={t("universidad_industria_gobierno_independiente")} value={datos.afiliacion} onChange={(e) => set("afiliacion", e.target.value)} />
          </div>
          <div>
            <label htmlFor="coautores">{t("coautores_opcional")}</label>
            <input type="text" id="coautores" placeholder={t("nombres_separados_por_comas_maximo_dos")} value={datos.coautores} onChange={(e) => set("coautores", e.target.value)} />
          </div>
        </div>
        <div className="fila2 campo">
          <div>
            <div className="etiqueta-fila">
              <label htmlFor="seccion">{es ? "Sección *" : "Section *"}</label>
              <Link href="/lineamientos#secciones" className="enlace-secciones">{t("consulta_las_secciones")}</Link>
            </div>
            <select id="seccion" value={datos.seccion} onChange={(e) => cambiarSeccion(e.target.value)}>
              <option value="">{t("elige_una_seccion")}</option>
              {SECCIONES_ENVIO.map((x) => <option key={x} value={x}>{nombreSeccion(x)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="genero">{es ? "Género *" : "Gender *"}</label>
            <select id="genero" value={datos.genero} onChange={(e) => set("genero", e.target.value)}>
              <option value="">{es ? "Elige una opción" : "Choose an option"}</option>
              {GENEROS_ENVIO.map((x) => <option key={x} value={x}>{x === "Prefiero no responder aquí" && !es ? "Prefer not to answer here" : x}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 1 ? " activo" : ""}`} data-paso="1">
        <legend>{es ? "Sobre la pieza" : "About the piece"}</legend>
        <div className="campo">
          <label htmlFor="tituloArt">{es ? "Título *" : "Title *"}</label>
          <input type="text" id="tituloArt" value={datos.titulo} onChange={(e) => set("titulo", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="tema">{t("tema_principal")}</label>
          <select id="tema" value={datos.tema} onChange={(e) => set("tema", e.target.value)}>
            <option value="">{t("elige_un_tema")}</option>
            {TOPICS.map((x) => <option key={x} value={x}>{tema(x)}</option>)}
            <option value="Otro tema">{t("otro_tema")}</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="claves">{t("palabras_clave")}</label>
          <input type="text" id="claves" placeholder={t("inflacion_politica_monetaria_expectativas")} value={datos.claves} onChange={(e) => set("claves", e.target.value)} />
          <p className="ayuda">{t("de_3_a_5_separadas_por_comas")}</p>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 2 ? " activo" : ""}`} data-paso="2">
        <legend>{es ? "Archivos y contenido de la pieza" : "Files and piece content"}</legend>
        <CamposArchivosEnvio seccion={datos.seccion} campos={datos.campos} archivos={archivos} locale={locale} onCampo={setCampo} onArchivos={ponerArchivos} onQuitar={(i) => setArchivos((a) => a.filter((_, k) => k !== i))} />
      </fieldset>

      <fieldset className={`paso${paso === 3 ? " activo" : ""}`} data-paso="3">
        <legend>{t("declaracion_de_autoria")}</legend>
        <div className="campo">
          <label htmlFor="usoIA">{t("uso_de_inteligencia_artificial")}</label>
          <select id="usoIA" value={datos.usoIA} onChange={(e) => set("usoIA", e.target.value)}>
            <option value="">{t("elige_una_opcion")}</option>
            <option value="No">{t("no_use_herramientas_de_ia_en_este_trabajo")}</option>
            <option value="Sí">{t("use_ia_como_apoyo_estilo_codigo_o_revision_y_lo_c38c")}</option>
          </select>
        </div>
        <label className="decl"><input type="checkbox" checked={datos.d1} onChange={(e) => set("d1", e.target.checked)} /><span>{t("el_trabajo_es_original_y_fue_escrito_por_quienes_8339")}</span></label>
        <label className="decl"><input type="checkbox" checked={datos.d2} onChange={(e) => set("d2", e.target.checked)} /><span>{t("no_esta_publicado_ni_en_revision_en_otro_medio")}</span></label>
        <label className="decl"><input type="checkbox" checked={datos.d3} onChange={(e) => set("d3", e.target.checked)} /><span>{t("acepto_el_proceso_de_dictaminacion_doble_ciego_y_53cf")}</span></label>
        <label className="decl"><input type="checkbox" checked={datos.d4} onChange={(e) => set("d4", e.target.checked)} /><span>{t("autorizo_la_publicacion_del_texto_en_la_edicion_adff")}</span></label>
        <label className="decl"><input type="checkbox" checked={datos.d5} onChange={(e) => set("d5", e.target.checked)} /><span>{t("he_leido_y_acepto_los_")}<a className="enlace-legal" href="/documentos/terminos-condiciones-privacidad-autores.pdf" target="_blank" rel="noopener noreferrer">{t("terminos_condiciones_y_el_aviso_de_privacidad_pa")}</a>{t("de_la_revista_estudiantil_vertices")}</span></label>
        <label className="decl"><input type="checkbox" checked={datos.d6} onChange={(e) => set("d6", e.target.checked)} /><span>{t("he_leido_y_acepto_la_")}<a className="enlace-legal" href="/documentos/cesion-derechos-uso-imagen.pdf" target="_blank" rel="noopener noreferrer">{t("cesion_de_derechos_de_uso_de_imagen")}</a>{t("de_la_revista_estudiantil_vertices")}</span></label>
      </fieldset>

      <p id="formError" role="alert">{error ? textoError(error) : ""}</p>
      <div className="wiz-acciones">
        <button type="button" className="boton" disabled={paso === 0 || !!enviando} onClick={() => { if (paso > 0) { setPaso(paso - 1); setError(null); } }}>{t("regresar")}</button>
        <button type="button" className="boton boton--lleno" disabled={!!enviando} onClick={continuar}>
          {enviando === "subiendo" ? t("subiendo_archivos") : enviando === "registrando" ? t("registrando_envio") : paso === 3 ? (es ? "Enviar" : "Submit") : (es ? "Continuar" : "Continue")}
        </button>
      </div>
    </form>
  );
}
