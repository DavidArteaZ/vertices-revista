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

/** Las etiquetas de los cuatro pasos, en el orden de PASOS. */
const CLAVE_PASO = ["paso_autoria", "paso_pieza", "paso_archivos", "paso_declaracion"] as const;

/**
 * El valor de cada opción de género viaja en español hasta la base y hasta la
 * plantilla del correo, así que no puede ser la clave de traducción: sólo la
 * etiqueta que se lee cambia de idioma. Las cuatro claves ya estaban en el
 * catálogo.
 */
const CLAVE_GENERO: Record<(typeof GENEROS_ENVIO)[number], string> = {
  "Prefiero no responder aquí": "prefiero_no_responder_aqui",
  Femenino: "femenino",
  Masculino: "masculino",
  Otro: "otro",
};

export default function FormularioEnvio() {
  const t = useTranslations("formularioenvio");
  const tAviso = useTranslations("avisos");
  const locale = useLocale();
  const { tema, seccion: nombreSeccion } = useCatalogo();
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
    return tAviso(a.clave, a.valores);
  }

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
            <i>{k + 1}</i>{t(CLAVE_PASO[k])}
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
              <label htmlFor="seccion">{t("campo_seccion")}</label>
              <Link href="/lineamientos#secciones" className="enlace-secciones">{t("consulta_las_secciones")}</Link>
            </div>
            <select id="seccion" value={datos.seccion} onChange={(e) => cambiarSeccion(e.target.value)}>
              <option value="">{t("elige_una_seccion")}</option>
              {SECCIONES_ENVIO.map((x) => <option key={x} value={x}>{nombreSeccion(x)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="genero">{t("campo_genero")}</label>
            <select id="genero" value={datos.genero} onChange={(e) => set("genero", e.target.value)}>
              <option value="">{t("elige_una_opcion")}</option>
              {GENEROS_ENVIO.map((x) => <option key={x} value={x}>{t(CLAVE_GENERO[x])}</option>)}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 1 ? " activo" : ""}`} data-paso="1">
        <legend>{t("sobre_la_pieza")}</legend>
        <div className="campo">
          <label htmlFor="tituloArt">{t("campo_titulo")}</label>
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
        <legend>{t("archivos_y_contenido_de_la_pieza")}</legend>
        <CamposArchivosEnvio seccion={datos.seccion} campos={datos.campos} archivos={archivos} onCampo={setCampo} onArchivos={ponerArchivos} onQuitar={(i) => setArchivos((a) => a.filter((_, k) => k !== i))} />
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
          {enviando === "subiendo" ? t("subiendo_archivos") : enviando === "registrando" ? t("registrando_envio") : paso === 3 ? t("enviar") : t("continuar")}
        </button>
      </div>
    </form>
  );
}
