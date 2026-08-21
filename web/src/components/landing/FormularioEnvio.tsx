"use client";

import { useRef, useState } from "react";
import { SECTIONS } from "@/lib/datos/secciones";
import { TOPICS } from "@/lib/datos/temas";
import {
  validarPaso,
  vacio,
  pesoTexto,
  EXT_OK,
  MAX_BYTES,
  type DatosEnvio,
} from "@/lib/validacion";

/**
 * Asistente de envío de manuscritos, 4 pasos.
 * Marcado de index.html:717-863, comportamiento de :2037-2265.
 *
 * En esta etapa no hay backend: el envío no viaja a ninguna parte. Lo que NO
 * se porta es el respaldo que inventa un folio y muestra éxito cuando el
 * registro falla (index.html:2172-2175): es el defecto 3 de la spec y se
 * elimina, no se arrastra.
 */

const PASOS = ["Autoría", "Manuscrito", "Archivos", "Declaración"];

export default function FormularioEnvio() {
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosEnvio>(vacio);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const set = <K extends keyof DatosEnvio>(k: K, val: DatosEnvio[K]) =>
    setDatos((d) => ({ ...d, [k]: val }));

  const palabras = datos.resumen.trim().split(/\s+/).filter(Boolean).length;

  function agregarArchivos(lista: FileList | File[]) {
    let err = "";
    const siguientes = [...archivos];
    for (const f of Array.from(lista)) {
      if (!EXT_OK.test(f.name)) {
        err = `"${f.name}" no es .pdf ni .docx.`;
        continue;
      }
      if (f.size > MAX_BYTES) {
        err = `"${f.name}" pesa más de 20 MB.`;
        continue;
      }
      if (!siguientes.some((x) => x.name === f.name && x.size === f.size)) siguientes.push(f);
      err = "";
    }
    setArchivos(siguientes);
    setError(err);
  }

  function continuar() {
    const err = validarPaso(paso, datos, archivos);
    if (err) { setError(err); return; }
    if (paso < 3) { setPaso(paso + 1); setError(""); return; }
    setEnviado(true);
  }

  function otroEnvio() {
    setDatos(vacio);
    setArchivos([]);
    setPaso(0);
    setError("");
    setEnviado(false);
  }

  if (enviado) {
    return (
      <div id="confirmacion">
        <p className="ceja">Envío registrado</p>
        <h3>Gracias por confiar en Vértices</h3>
        <p>Tu manuscrito quedó registrado con el folio <strong id="folio">VTX-2026-000</strong>. Guárdalo: con él y tu correo puedes consultar el avance en <a href="#estado" data-ir="estado">Estado de tu envío</a>. Tu pieza entrará al proceso de dictaminación de su sección y el comité editorial te escribirá al correo que registraste.</p>
        <p className="ayuda">El registro todavía no está conectado: esta pantalla es sólo la interfaz.</p>
        <dl>
          <dt>Título</dt><dd id="resTitulo">{datos.titulo}</dd>
          <dt>Autoría</dt><dd id="resAutor">{datos.nombre}{datos.coautores ? `, ${datos.coautores}` : ""}</dd>
          <dt>Formato</dt><dd id="resFormato">{datos.formato}</dd>
          <dt>Sección</dt><dd id="resSeccion">{datos.seccion}</dd>
        </dl>
        <button type="button" className="boton" id="otroEnvio" onClick={otroEnvio}>Enviar otro manuscrito</button>
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
            onClick={() => { if (k < paso) { setPaso(k); setError(""); } }}
          >
            <i>{k + 1}</i>{p}
          </li>
        ))}
      </ol>

      <fieldset className={`paso${paso === 0 ? " activo" : ""}`} data-paso="0">
        <legend>Datos de autoría</legend>
        <div className="campo">
          <label htmlFor="nombre">Nombre completo *</label>
          <input type="text" id="nombre" name="nombre" autoComplete="name" value={datos.nombre} onChange={(e) => set("nombre", e.target.value)} />
        </div>
        <div className="fila2 campo">
          <div>
            <label htmlFor="correo">Correo de contacto *</label>
            <input type="email" id="correo" name="correo" placeholder="tucorreo@ejemplo.com" autoComplete="email" value={datos.correo} onChange={(e) => set("correo", e.target.value)} />
          </div>
          <div>
            <label htmlFor="perfil">Perfil de autor *</label>
            <select id="perfil" name="perfil" value={datos.perfil} onChange={(e) => set("perfil", e.target.value)}>
              <option value="">Elige tu perfil</option>
              <option value="Estudiante de licenciatura en Economía">Estudiante de licenciatura en Economía</option>
              <option value="Estudiante de otra licenciatura">Estudiante de otra licenciatura</option>
              <option value="Economista titulado (licenciatura, maestría o doctorado)">Economista titulado (licenciatura, maestría o doctorado)</option>
              <option value="Científico(a) de datos">Científico(a) de datos</option>
              <option value="Científico(a) social">Científico(a) social</option>
              <option value="Otro perfil interesado en la economía">Otro perfil interesado en la economía</option>
            </select>
          </div>
        </div>
        <div className="fila2 campo">
          <div>
            <label htmlFor="afiliacion">Institución o afiliación *</label>
            <input type="text" id="afiliacion" name="afiliacion" placeholder="Universidad, industria, gobierno, independiente..." value={datos.afiliacion} onChange={(e) => set("afiliacion", e.target.value)} />
          </div>
          <div>
            <label htmlFor="coautores">Coautores (opcional)</label>
            <input type="text" id="coautores" name="coautores" placeholder="Nombres separados por comas, máximo dos" value={datos.coautores} onChange={(e) => set("coautores", e.target.value)} />
          </div>
        </div>
        <div className="campo">
          <label htmlFor="genero">Género (opcional, para el registro de equidad de autoría)</label>
          <select id="genero" name="genero" value={datos.genero} onChange={(e) => set("genero", e.target.value)}>
            <option value="">Prefiero no responder aquí</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
            <option value="Otro">Otro</option>
            <option value="Prefiere no decir">Prefiere no decir</option>
          </select>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 1 ? " activo" : ""}`} data-paso="1">
        <legend>Sobre el manuscrito</legend>
        <div className="campo">
          <label htmlFor="tituloArt">Título del trabajo *</label>
          <input type="text" id="tituloArt" name="titulo" value={datos.titulo} onChange={(e) => set("titulo", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="formato">Formato de la pieza *</label>
          <select id="formato" name="formato" value={datos.formato} onChange={(e) => set("formato", e.target.value)}>
            <option value="">Elige un formato</option>
            <option value="Paper o abstract de investigación">Paper o abstract de investigación</option>
            <option value="Artículo con datos o visualización">Artículo con datos o visualización</option>
            <option value="Entrevista o artículo de opinión verificado">Entrevista o artículo de opinión verificado</option>
            <option value="Cápsula breve">Cápsula breve</option>
            <option value="Otro formato">Otro formato</option>
          </select>
        </div>
        <div className="fila2 campo">
          <div>
            <label htmlFor="seccion">Sección sugerida *</label>
            <select id="seccion" name="seccion" value={datos.seccion} onChange={(e) => set("seccion", e.target.value)}>
              <option value="">Elige una sección</option>
              {SECTIONS.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
              <option value="Aún no lo decido">Aún no lo decido</option>
            </select>
          </div>
          <div>
            <label htmlFor="tema">Tema principal *</label>
            <select id="tema" name="tema" value={datos.tema} onChange={(e) => set("tema", e.target.value)}>
              <option value="">Elige un tema</option>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="Otro tema">Otro tema</option>
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="resumen">Resumen *</label>
          <textarea id="resumen" name="resumen" rows={6} placeholder="¿Qué pregunta respondes, con qué método y qué encontraste?" value={datos.resumen} onChange={(e) => set("resumen", e.target.value)} />
          <p className="ayuda contador" id="contadorResumen">
            {palabras === 1 ? "1 palabra · se piden entre 100 y 300" : `${palabras} palabras · se piden entre 100 y 300`}
          </p>
        </div>
        <div className="campo">
          <label htmlFor="claves">Palabras clave *</label>
          <input type="text" id="claves" name="claves" placeholder="inflación, política monetaria, expectativas" value={datos.claves} onChange={(e) => set("claves", e.target.value)} />
          <p className="ayuda">De 3 a 5, separadas por comas.</p>
        </div>
      </fieldset>

      <fieldset className={`paso${paso === 2 ? " activo" : ""}`} data-paso="2">
        <legend>Archivos del trabajo</legend>
        <label
          className={`zona-archivo${sobre ? " sobre" : ""}`}
          id="zonaArchivo"
          htmlFor="archivoInput"
          onDragEnter={(e) => { e.preventDefault(); setSobre(true); }}
          onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
          onDragLeave={(e) => { e.preventDefault(); setSobre(false); }}
          onDrop={(e) => { e.preventDefault(); setSobre(false); agregarArchivos(e.dataTransfer.files); }}
        >
          <strong>Arrastra tu manuscrito aquí</strong>
          <span>o haz clic para buscarlo · .docx o .pdf · máximo 20 MB</span>
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
                aria-label="Quitar archivo"
                onClick={() => setArchivos(archivos.filter((_, k) => k !== i))}
              >✕</button>
            </li>
          ))}
        </ul>
        <p className="ayuda">Si tu trabajo incluye gráficas o tablas, adjunta también el archivo editable con los datos.</p>
      </fieldset>

      <fieldset className={`paso${paso === 3 ? " activo" : ""}`} data-paso="3">
        <legend>Declaración de autoría</legend>
        <div className="campo">
          <label htmlFor="usoIA">Uso de inteligencia artificial *</label>
          <select id="usoIA" name="usoIA" value={datos.usoIA} onChange={(e) => set("usoIA", e.target.value)}>
            <option value="">Elige una opción</option>
            <option value="No">No usé herramientas de IA en este trabajo</option>
            <option value="Sí">Usé IA como apoyo (estilo, código o revisión) y lo declaro en el manuscrito</option>
          </select>
        </div>
        <label className="decl"><input type="checkbox" id="d1" checked={datos.d1} onChange={(e) => set("d1", e.target.checked)} /><span>El trabajo es original y fue escrito por quienes aparecen como autores.</span></label>
        <label className="decl"><input type="checkbox" id="d2" checked={datos.d2} onChange={(e) => set("d2", e.target.checked)} /><span>No está publicado ni en revisión en otro medio.</span></label>
        <label className="decl"><input type="checkbox" id="d3" checked={datos.d3} onChange={(e) => set("d3", e.target.checked)} /><span>Acepto el proceso de dictaminación doble ciego y los ajustes editoriales que resulten.</span></label>
        <label className="decl"><input type="checkbox" id="d4" checked={datos.d4} onChange={(e) => set("d4", e.target.checked)} /><span>Autorizo la publicación del texto en la edición en PDF y en el sitio web de Vértices.</span></label>
      </fieldset>

      <p id="formError" role="alert">{error}</p>
      <div className="wiz-acciones">
        <button type="button" className="boton" id="atras" disabled={paso === 0} onClick={() => { if (paso > 0) { setPaso(paso - 1); setError(""); } }}>Regresar</button>
        <button type="button" className="boton boton--lleno" id="continuar" onClick={continuar}>
          {paso === 3 ? "Enviar manuscrito" : "Continuar"}
        </button>
      </div>
    </form>
  );
}
