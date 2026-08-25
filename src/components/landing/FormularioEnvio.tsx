"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useCatalogo } from "@/i18n/catalogo";
import { SECTIONS } from "@/lib/datos/secciones";
import { TOPICS } from "@/lib/datos/temas";
import { TIPOS_PIEZA } from "@/lib/datos/tipos";
import { enviarManuscrito, esError, type Progreso } from "@/lib/cliente/enviar";
import {
  validarPaso,
  vacio,
  pesoTexto,
  EXT_OK,
  MAX_ARCHIVOS,
  MAX_BYTES,
  AVISO,
  type Aviso,
  type DatosEnvio,
} from "@/lib/validacion";

/**
 * Asistente de envío de manuscritos, 4 pasos.
 * Marcado de index.html:717-863, comportamiento de :2037-2265.
 *
 * Lo que NO se porta es el respaldo que inventa un folio y muestra éxito
 * cuando el registro falla (index.html:2172-2175): es el defecto 3 de la spec
 * y se elimina, no se arrastra. Si el registro falla, se muestra el error y el
 * formulario conserva lo escrito, que es justo lo que hoy no pasa.
 */

/** Rótulos de los cuatro pasos, en el orden de index.html:719-724. */
const PASOS = ["autoria", "manuscrito", "archivos", "declaracion"] as const;

export default function FormularioEnvio() {
  const t = useTranslations("formularioenvio");
  const tAviso = useTranslations("avisos");
  const locale = useLocale();
  const { tema, seccion } = useCatalogo();
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosEnvio>(vacio);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<Aviso | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<Progreso | null>(null);
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const set = <K extends keyof DatosEnvio>(k: K, val: DatosEnvio[K]) =>
    setDatos((d) => ({ ...d, [k]: val }));

  const palabras = datos.resumen.trim().split(/\s+/).filter(Boolean).length;

  function agregarArchivos(lista: FileList | File[]) {
    let err: Aviso | null = null;
    const siguientes = [...archivos];
    for (const f of Array.from(lista)) {
      if (!EXT_OK.test(f.name)) {
        err = { clave: AVISO.extension, valores: { a: f.name } };
        continue;
      }
      if (f.size > MAX_BYTES) {
        err = { clave: AVISO.peso, valores: { a: f.name } };
        continue;
      }
      if (!siguientes.some((x) => x.name === f.name && x.size === f.size)) siguientes.push(f);
      err = null;
    }
    if (siguientes.length > MAX_ARCHIVOS) {
      setError({ clave: "puedes_adjuntar_como_maximo_5_archivos" });
      return;
    }
    setArchivos(siguientes);
    setError(err);
  }

  async function continuar() {
    if (enviando) return;
    const err = validarPaso(paso, datos, archivos);
    if (err) { setError(err); return; }
    if (paso < 3) { setPaso(paso + 1); setError(null); return; }

    setError(null);
    const resultado = await enviarManuscrito(datos, archivos, locale, setEnviando);
    setEnviando(null);

    // Nada de folios inventados: si no volvió uno, esto no fue un envío. Los
    // datos y los archivos se quedan donde están para poder reintentar.
    if (esError(resultado)) { setError(resultado.error); return; }
    setFolio(resultado.folio);
  }

  function otroEnvio() {
    setDatos(vacio);
    setArchivos([]);
    setPaso(0);
    setError(null);
    setFolio(null);
  }

  if (folio) {
    return (
      <div id="confirmacion">
        <p className="ceja">{t("envio_registrado")}</p>
        <h3>{t("gracias_por_confiar_en_vertices")}</h3>
        <p>{t("tu_manuscrito_quedo_registrado_con_el_folio")}{" "}<strong id="folio">{folio}</strong>{t("guardalo_con_el_y_tu_correo_puedes_consultar_el_e92d")}{" "}<a href="#estado" data-ir="estado">{t("estado_de_tu_envio")}</a>{t("tu_pieza_entrara_al_proceso_de_dictaminacion_de_79ea")}</p>
        <p className="ayuda">{t("te_escribimos_un_acuse_a_tu_correo")}</p>
        <dl>
          <dt>{t("titulo")}</dt><dd id="resTitulo">{datos.titulo}</dd>
          <dt>{t("autoria")}</dt><dd id="resAutor">{datos.nombre}{datos.coautores ? `, ${datos.coautores}` : ""}</dd>
          <dt>{t("formato")}</dt><dd id="resFormato">{datos.formato}</dd>
          <dt>{t("seccion")}</dt><dd id="resSeccion">{datos.seccion}</dd>
        </dl>
        <button type="button" className="boton" id="otroEnvio" onClick={otroEnvio}>{t("enviar_otro_manuscrito")}</button>
      </div>
    );
  }

  return (
    <form id="formulario" noValidate onSubmit={(e) => e.preventDefault()}>
      <ol className="wiz-pasos" id="wizPasos">
        {PASOS.map((p, k) => (
          <li
            key={p}
            className={k === paso ? "activo" : k < paso ? "hecho" : undefined}
            data-paso={k}
            onClick={() => { if (k < paso) { setPaso(k); setError(null); } }}
          >
            <i>{k + 1}</i>{t(`paso_${p}`)}
          </li>
        ))}
      </ol>

      <fieldset className={`paso${paso === 0 ? " activo" : ""}`} data-paso="0">
        <legend>{t("datos_de_autoria")}</legend>
        <div className="campo">
          <label htmlFor="nombre">{t("nombre_completo")}</label>
          <input type="text" id="nombre" name="nombre" autoComplete="name" value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </div>
        <div className="fila2 campo">
          <div>
            <label htmlFor="correo">{t("correo_de_contacto")}</label>
            <input type="email" id="correo" name="correo" placeholder={t("tucorreo_ejemplo_com")} autoComplete="email" value={datos.correo} onChange={(e) => set("correo", e.target.value)} />
          </div>
          <div>
            <label htmlFor="perfil">{t("perfil_de_autor")}</label>
            <select id="perfil" name="perfil" value={datos.perfil} onChange={(e) => set("perfil", e.target.value)}>
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
            <input type="text" id="afiliacion" name="afiliacion" placeholder={t("universidad_industria_gobierno_independiente")} value={datos.afiliacion} onChange={(e) => set("afiliacion", e.target.value)} />
          </div>
          <div>
            <label htmlFor="coautores">{t("coautores_opcional")}</label>
            <input type="text" id="coautores" name="coautores" placeholder={t("nombres_separados_por_comas_maximo_dos")} value={datos.coautores} onChange={(e) => set("coautores", e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="genero">{t("genero_opcional_para_el_registro_de_equidad_de_a_970a")}</label>
          <select id="genero" name="genero" value={datos.genero} onChange={(e) => set("genero", e.target.value)}>
            <option value="">{t("prefiero_no_responder_aqui")}</option>
            <option value="Femenino">{t("femenino")}</option>
            <option value="Masculino">{t("masculino")}</option>
            <option value="Otro">{t("otro")}</option>
            <option value="Prefiere no decir">{t("prefiere_no_decir")}</option>
          </select>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 1 ? " activo" : ""}`} data-paso="1">
        <legend>{t("sobre_el_manuscrito")}</legend>
        <div className="campo">
          <label htmlFor="tituloArt">{t("titulo_del_trabajo")}</label>
          <input type="text" id="tituloArt" name="titulo" value={datos.titulo} onChange={(e) => set("titulo", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="formato">{t("formato_de_la_pieza")}</label>
          <select id="formato" name="formato" value={datos.formato} onChange={(e) => set("formato", e.target.value)}>
            <option value="">{t("elige_un_formato")}</option>
            {/* Los nueve tipos canónicos del catálogo, en lugar de las cinco
                opciones que no cruzaban con nada (spec §8). El value sigue en
                español en los seis idiomas: es lo que el servidor resuelve
                contra public.tipos_pieza. */}
            {TIPOS_PIEZA.map((x) => (
              <option key={x.nombre} value={x.nombre}>{t(x.clave)}</option>
            ))}
          </select>
        </div>
        <div className="fila2 campo">
          <div>
            <div className="etiqueta-fila">
              <label htmlFor="seccion">{t("seccion_sugerida")}</label>
              <Link href="/lineamientos#secciones" className="enlace-secciones">{t("consulta_las_secciones")}</Link>
            </div>
            <select id="seccion" name="seccion" value={datos.seccion} onChange={(e) => set("seccion", e.target.value)}>
              <option value="">{t("elige_una_seccion")}</option>
              {SECTIONS.map((s) => <option key={s.label} value={s.label}>{seccion(s.label)}</option>)}
              <option value="Aún no lo decido">{t("aun_no_lo_decido")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="tema">{t("tema_principal")}</label>
            <select id="tema" name="tema" value={datos.tema} onChange={(e) => set("tema", e.target.value)}>
              <option value="">{t("elige_un_tema")}</option>
              {TOPICS.map((x) => <option key={x} value={x}>{tema(x)}</option>)}
              <option value="Otro tema">{t("otro_tema")}</option>
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="resumen">{t("resumen")}</label>
          <textarea id="resumen" name="resumen" rows={6} placeholder={t("que_pregunta_respondes_con_que_metodo_y_que_enco_a6c1")} value={datos.resumen} onChange={(e) => set("resumen", e.target.value)} />
          <p className="ayuda contador" id="contadorResumen">
            {/* La rama singular/plural se conserva tal cual del original
                (index.html:2219). No se convierte a `plural` de ICU: el ruso
                tiene tres formas y el portugués otra regla, así que ICU
                produciría textos que el sitio actual nunca muestra. */}
            {palabras === 1
              ? t("contador_singular", { n: palabras })
              : t("contador_plural", { n: palabras })}
          </p>
        </div>
        <div className="campo">
          <label htmlFor="claves">{t("palabras_clave")}</label>
          <input type="text" id="claves" name="claves" placeholder={t("inflacion_politica_monetaria_expectativas")} value={datos.claves} onChange={(e) => set("claves", e.target.value)} />
          <p className="ayuda">{t("de_3_a_5_separadas_por_comas")}</p>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 2 ? " activo" : ""}`} data-paso="2">
        <legend>{t("archivos_del_trabajo")}</legend>
        <label
          className={`zona-archivo${sobre ? " sobre" : ""}`}
          id="zonaArchivo"
          htmlFor="archivoInput"
          onDragEnter={(e) => { e.preventDefault(); setSobre(true); }}
          onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
          onDragLeave={(e) => { e.preventDefault(); setSobre(false); }}
          onDrop={(e) => { e.preventDefault(); setSobre(false); agregarArchivos(e.dataTransfer.files); }}
        >
          <strong>{t("arrastra_tu_manuscrito_aqui")}</strong>
          <span>{t("o_haz_clic_para_buscarlo_docx_o_pdf_maximo_20_mb")}</span>
        </label>
        <input
          type="file"
          id="archivoInput"
          ref={input}
          accept=".pdf,.doc,.docx"
          multiple
          hidden
          onChange={(e) => { if (e.target.files) agregarArchivos(e.target.files); e.target.value = ""; }}
        />
        <ul id="listaArchivos">
          {archivos.map((f, i) => (
            <li key={`${f.name}-${f.size}`}>
              <span>{f.name}</span>
              <span className="peso">{pesoTexto(f.size)}</span>
              <button
                type="button"
                data-quitar={i}
                aria-label={t("quitar_archivo")}
                onClick={() => setArchivos(archivos.filter((_, k) => k !== i))}
              >✕</button>
            </li>
          ))}
        </ul>
        <p className="ayuda">{t("si_tu_trabajo_incluye_graficas_o_tablas_adjunta_550d")}</p>
      </fieldset>

      <fieldset className={`paso${paso === 3 ? " activo" : ""}`} data-paso="3">
        <legend>{t("declaracion_de_autoria")}</legend>
        <div className="campo">
          <label htmlFor="usoIA">{t("uso_de_inteligencia_artificial")}</label>
          <select id="usoIA" name="usoIA" value={datos.usoIA} onChange={(e) => set("usoIA", e.target.value)}>
            <option value="">{t("elige_una_opcion")}</option>
            <option value="No">{t("no_use_herramientas_de_ia_en_este_trabajo")}</option>
            <option value="Sí">{t("use_ia_como_apoyo_estilo_codigo_o_revision_y_lo_c38c")}</option>
          </select>
        </div>
        <label className="decl"><input type="checkbox" id="d1" checked={datos.d1} onChange={(e) => set("d1", e.target.checked)} /><span>{t("el_trabajo_es_original_y_fue_escrito_por_quienes_8339")}</span></label>
        <label className="decl"><input type="checkbox" id="d2" checked={datos.d2} onChange={(e) => set("d2", e.target.checked)} /><span>{t("no_esta_publicado_ni_en_revision_en_otro_medio")}</span></label>
        <label className="decl"><input type="checkbox" id="d3" checked={datos.d3} onChange={(e) => set("d3", e.target.checked)} /><span>{t("acepto_el_proceso_de_dictaminacion_doble_ciego_y_53cf")}</span></label>
        <label className="decl"><input type="checkbox" id="d4" checked={datos.d4} onChange={(e) => set("d4", e.target.checked)} /><span>{t("autorizo_la_publicacion_del_texto_en_la_edicion_adff")}</span></label>
      </fieldset>

      <p id="formError" role="alert">{error ? tAviso(error.clave, error.valores) : ""}</p>
      <div className="wiz-acciones">
        <button type="button" className="boton" id="atras" disabled={paso === 0 || !!enviando} onClick={() => { if (paso > 0) { setPaso(paso - 1); setError(null); } }}>{t("regresar")}</button>
        <button type="button" className="boton boton--lleno" id="continuar" disabled={!!enviando} onClick={continuar}>
          {enviando === "subiendo"
            ? t("subiendo_archivos")
            : enviando === "registrando"
              ? t("registrando_envio")
              : paso === 3 ? "Enviar manuscrito" : "Continuar"}
        </button>
      </div>
    </form>
  );
}
