"use client";

import type { ArchivoEnvio } from "@/lib/cliente/enviar";
import type { RolArchivo } from "@/lib/datos/portal-envios";
import { MODALIDADES_ENTREVISTA } from "@/lib/datos/portal-envios";
import { contarPalabras, type CamposSeccion } from "@/lib/validacion";

type Props = {
  seccion: string;
  campos: CamposSeccion;
  archivos: ArchivoEnvio[];
  locale: string;
  onCampo: <K extends keyof CamposSeccion>(clave: K, valor: CamposSeccion[K]) => void;
  onArchivos: (rol: RolArchivo, files: File[], maximo: number) => void;
  onQuitar: (indice: number) => void;
};

const CESION = "/documentos/cesion-derechos-uso-imagen.pdf";

function CampoArchivo({
  id,
  titulo,
  ayuda,
  rol,
  accept,
  maximo,
  archivos,
  onArchivos,
  onQuitar,
}: {
  id: string;
  titulo: string;
  ayuda: string;
  rol: RolArchivo;
  accept: string;
  maximo: number;
  archivos: ArchivoEnvio[];
  onArchivos: Props["onArchivos"];
  onQuitar: Props["onQuitar"];
}) {
  const propios = archivos
    .map((x, indice) => ({ ...x, indice }))
    .filter((x) => x.rol === rol);

  return (
    <div className="campo">
      <label htmlFor={id}>{titulo}</label>
      <label className="zona-archivo zona-archivo--compacta" htmlFor={id}>
        <strong>{propios.length ? `${propios.length} archivo${propios.length === 1 ? "" : "s"}` : "Seleccionar archivo"}</strong>
        <span>{ayuda}</span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={maximo > 1}
        hidden
        onChange={(e) => {
          if (e.target.files) onArchivos(rol, Array.from(e.target.files), maximo);
          e.target.value = "";
        }}
      />
      {propios.length > 0 && (
        <ul className="lista-archivos lista-archivos--campo">
          {propios.map(({ archivo, indice }) => (
            <li key={`${rol}-${archivo.name}-${archivo.size}-${indice}`}>
              <span>{archivo.name}</span>
              <button type="button" onClick={() => onQuitar(indice)} aria-label={`Quitar ${archivo.name}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CamposArchivosEnvio(props: Props) {
  const { seccion, campos, archivos, locale, onCampo, onArchivos, onQuitar } = props;
  const es = locale === "es";
  const palabras = (texto: string) => contarPalabras(texto);
  const contador = (texto: string, min: number | null, max: number) => {
    const n = palabras(texto);
    return es
      ? `${n} palabras${min ? ` · mínimo ${min}` : ""} · máximo ${max}`
      : `${n} words${min ? ` · minimum ${min}` : ""} · maximum ${max}`;
  };
  const repo = (
    <div className="campo">
      <label htmlFor="repositorio">{es ? "Repositorio (opcional)" : "Repository (optional)"}</label>
      <input
        id="repositorio"
        type="url"
        placeholder="https://"
        value={campos.repositorio}
        onChange={(e) => onCampo("repositorio", e.target.value)}
      />
    </div>
  );

  if (seccion === "Datanomics") {
    return (
      <>
        <div className="campo">
          <label htmlFor="textoExplicativo">{es ? "Texto explicativo *" : "Explanatory text *"}</label>
          <textarea id="textoExplicativo" rows={8} value={campos.textoExplicativo} onChange={(e) => onCampo("textoExplicativo", e.target.value)} />
          <p className="ayuda contador">{contador(campos.textoExplicativo, 200, 800)}</p>
        </div>
        <CampoArchivo id="visualizacion" titulo={es ? "Visualización *" : "Visualization *"} ayuda={es ? "Hasta 3 imágenes (JPG, PNG o WebP)" : "Up to 3 images (JPG, PNG or WebP)"} rol="visualizacion" accept="image/jpeg,image/png,image/webp" maximo={3} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        {repo}
      </>
    );
  }

  if (seccion === "La Voz de la Experiencia") {
    return (
      <>
        <div className="campo">
          <label htmlFor="semblanza">{es ? "Semblanza *" : "Profile *"}</label>
          <textarea id="semblanza" rows={6} placeholder={es ? "Cargo, años de experiencia, trayectoria" : "Role, years of experience, career path"} value={campos.semblanza} onChange={(e) => onCampo("semblanza", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="modalidadEntrevista">{es ? "Modalidad de entrevista *" : "Interview format *"}</label>
          <select id="modalidadEntrevista" value={campos.modalidadEntrevista} onChange={(e) => onCampo("modalidadEntrevista", e.target.value)}>
            <option value="">{es ? "Elige una modalidad" : "Choose a format"}</option>
            {MODALIDADES_ENTREVISTA.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <CampoArchivo id="fotoVoz" titulo={es ? "Foto suya *" : "Portrait photo *"} ayuda={es ? "1 imagen (JPG, PNG o WebP)" : "1 image (JPG, PNG or WebP)"} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <CampoArchivo id="cesionVoz" titulo={es ? "Cesión de derechos de imagen llenada y firmada *" : "Signed image rights release *"} ayuda="PDF" rol="cesion_imagen" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <p className="ayuda enlace-documento"><a href={CESION} target="_blank" rel="noopener noreferrer">{es ? "Cesión de derechos de imagen" : "Image rights release"}</a></p>
      </>
    );
  }

  if (seccion === "Miradas Económicas") {
    return (
      <>
        <div className="campo">
          <label htmlFor="resumenMiradas">{es ? "Resumen *" : "Abstract *"}</label>
          <textarea id="resumenMiradas" rows={7} value={campos.resumen} onChange={(e) => onCampo("resumen", e.target.value)} />
          <p className="ayuda contador">{contador(campos.resumen, 100, 300)}</p>
        </div>
        <CampoArchivo id="paper" titulo={es ? "Paper *" : "Paper *"} ayuda={es ? "PDF · máximo 35 cuartillas" : "PDF · maximum 35 pages"} rol="paper" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <CampoArchivo id="anexos" titulo={es ? "Anexos (opcional)" : "Appendices (optional)"} ayuda={es ? "Hasta 3 archivos PDF" : "Up to 3 PDF files"} rol="anexo" accept="application/pdf" maximo={3} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        {repo}
      </>
    );
  }

  if (seccion === "Horizonte Global") {
    return (
      <>
        <div className="campo">
          <label htmlFor="resumenHorizonte">{es ? "Resumen *" : "Summary *"}</label>
          <textarea id="resumenHorizonte" rows={7} value={campos.resumen} onChange={(e) => onCampo("resumen", e.target.value)} />
          <p className="ayuda contador">{contador(campos.resumen, null, 200)}</p>
        </div>
        <CampoArchivo id="articulo" titulo={es ? "Artículo *" : "Article *"} ayuda={es ? "PDF · 800 a 1500 palabras · incluir gráficas en el PDF" : "PDF · 800 to 1,500 words · include charts in the PDF"} rol="articulo" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
      </>
    );
  }

  if (seccion === "¿Sabías Qué?") {
    return (
      <>
        <div className="campo">
          <label htmlFor="dato">{es ? "Dato *" : "Fact *"}</label>
          <textarea id="dato" rows={7} value={campos.dato} onChange={(e) => onCampo("dato", e.target.value)} />
          <p className="ayuda contador">{contador(campos.dato, null, 200)}</p>
        </div>
        <CampoArchivo id="imagenSabias" titulo={es ? "Imagen (opcional)" : "Image (optional)"} ayuda={es ? "Máximo 1 imagen (JPG, PNG o WebP)" : "Maximum 1 image (JPG, PNG or WebP)"} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
      </>
    );
  }

  if (seccion === "Capital Social") {
    return (
      <>
        <div className="campo">
          <label htmlFor="cronicaCapital">{es ? "Crónica *" : "Chronicle *"}</label>
          <textarea id="cronicaCapital" rows={9} value={campos.cronica} onChange={(e) => onCampo("cronica", e.target.value)} />
          <p className="ayuda contador">{contador(campos.cronica, 500, 900)}</p>
        </div>
        <CampoArchivo id="fotosCapital" titulo={es ? "Foto *" : "Photos *"} ayuda={es ? "De 1 a 4 imágenes (JPG, PNG o WebP)" : "1 to 4 images (JPG, PNG or WebP)"} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={4} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <div className="campo">
          <label htmlFor="piesImagen">{es ? "Pies de imagen *" : "Image captions *"}</label>
          <textarea id="piesImagen" rows={4} placeholder={es ? "En orden, separados por coma" : "In order, separated by commas"} value={campos.piesImagen} onChange={(e) => onCampo("piesImagen", e.target.value)} />
        </div>
      </>
    );
  }

  if (seccion === "Excelencia en Acción") {
    return (
      <>
        <div className="campo">
          <label htmlFor="semblanzaExcelencia">{es ? "Semblanza *" : "Profile *"}</label>
          <textarea id="semblanzaExcelencia" rows={6} placeholder={es ? "Semestre, logro, historia breve, etc." : "Semester, achievement, brief story, etc."} value={campos.semblanza} onChange={(e) => onCampo("semblanza", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cronicaExcelencia">{es ? "Crónica *" : "Chronicle *"}</label>
          <textarea id="cronicaExcelencia" rows={8} placeholder={es ? "¿Cómo consiguió la oportunidad? ¿Cuáles fueron los mayores desafíos? ¿Qué aprendizajes le dejó?" : "How did you get the opportunity? What were the biggest challenges? What did you learn?"} value={campos.cronica} onChange={(e) => onCampo("cronica", e.target.value)} />
        </div>
        <CampoArchivo id="fotoExcelencia" titulo={es ? "Foto suya *" : "Portrait photo *"} ayuda={es ? "1 imagen (JPG, PNG o WebP)" : "1 image (JPG, PNG or WebP)"} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <CampoArchivo id="cesionExcelencia" titulo={es ? "Cesión de derechos de imagen llenada y firmada *" : "Signed image rights release *"} ayuda="PDF" rol="cesion_imagen" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <p className="ayuda enlace-documento"><a href={CESION} target="_blank" rel="noopener noreferrer">{es ? "Cesión de derechos de imagen" : "Image rights release"}</a></p>
      </>
    );
  }

  return <p className="ayuda">{es ? "Selecciona una sección en el paso de Autoría." : "Choose a section in the Authorship step."}</p>;
}
