"use client";

import { useTranslations } from "next-intl";

import type { ArchivoEnvio } from "@/lib/cliente/enviar";
import type { RolArchivo } from "@/lib/datos/portal-envios";
import { MODALIDADES_ENTREVISTA } from "@/lib/datos/portal-envios";
import { contarPalabras, type CamposSeccion } from "@/lib/validacion";

type Props = {
  seccion: string;
  campos: CamposSeccion;
  archivos: ArchivoEnvio[];
  onCampo: <K extends keyof CamposSeccion>(clave: K, valor: CamposSeccion[K]) => void;
  onArchivos: (rol: RolArchivo, files: File[], maximo: number) => void;
  onQuitar: (indice: number) => void;
};

const CESION = "/documentos/cesion-derechos-uso-imagen.pdf";

/** Por lo mismo que el género: el valor se guarda en español, sólo la etiqueta se traduce. */
const CLAVE_MODALIDAD: Record<(typeof MODALIDADES_ENTREVISTA)[number], string> = {
  Presencial: "presencial",
  "En línea": "en_linea",
};

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
  const t = useTranslations("camposarchivosenvio");
  const propios = archivos
    .map((x, indice) => ({ ...x, indice }))
    .filter((x) => x.rol === rol);

  return (
    <div className="campo">
      <label htmlFor={id}>{titulo}</label>
      <label className="zona-archivo zona-archivo--compacta" htmlFor={id}>
        <strong>{propios.length ? t("n_archivos", { n: propios.length }) : t("seleccionar_archivo")}</strong>
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
              <button type="button" onClick={() => onQuitar(indice)} aria-label={t("quitar_a", { a: archivo.name })}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CamposArchivosEnvio(props: Props) {
  const { seccion, campos, archivos, onCampo, onArchivos, onQuitar } = props;
  const t = useTranslations("camposarchivosenvio");
  const contador = (texto: string, min: number | null, max: number) => {
    const n = contarPalabras(texto);
    return min === null ? t("contador_max", { n, max }) : t("contador_min_max", { n, min, max });
  };
  const repo = (
    <div className="campo">
      <label htmlFor="repositorio">{t("repositorio_opcional")}</label>
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
          <label htmlFor="textoExplicativo">{t("texto_explicativo")}</label>
          <textarea id="textoExplicativo" rows={8} value={campos.textoExplicativo} onChange={(e) => onCampo("textoExplicativo", e.target.value)} />
          <p className="ayuda contador">{contador(campos.textoExplicativo, 200, 800)}</p>
        </div>
        <CampoArchivo id="visualizacion" titulo={t("visualizacion")} ayuda={t("hasta_3_imagenes_jpg_png_o_webp")} rol="visualizacion" accept="image/jpeg,image/png,image/webp" maximo={3} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        {repo}
      </>
    );
  }

  if (seccion === "La Voz de la Experiencia") {
    return (
      <>
        <div className="campo">
          <label htmlFor="semblanza">{t("semblanza")}</label>
          <textarea id="semblanza" rows={6} placeholder={t("cargo_anos_de_experiencia_trayectoria")} value={campos.semblanza} onChange={(e) => onCampo("semblanza", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="modalidadEntrevista">{t("modalidad_de_entrevista")}</label>
          <select id="modalidadEntrevista" value={campos.modalidadEntrevista} onChange={(e) => onCampo("modalidadEntrevista", e.target.value)}>
            <option value="">{t("elige_una_modalidad")}</option>
            {MODALIDADES_ENTREVISTA.map((x) => <option key={x} value={x}>{t(CLAVE_MODALIDAD[x])}</option>)}
          </select>
        </div>
        <CampoArchivo id="fotoVoz" titulo={t("foto_suya")} ayuda={t("1_imagen_jpg_png_o_webp")} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <CampoArchivo id="cesionVoz" titulo={t("cesion_de_derechos_de_imagen_llenada_y_firmada")} ayuda="PDF" rol="cesion_imagen" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <p className="ayuda enlace-documento"><a href={CESION} target="_blank" rel="noopener noreferrer">{t("cesion_de_derechos_de_imagen")}</a></p>
      </>
    );
  }

  if (seccion === "Miradas Económicas") {
    return (
      <>
        <div className="campo">
          <label htmlFor="resumenMiradas">{t("resumen_miradas")}</label>
          <textarea id="resumenMiradas" rows={7} value={campos.resumen} onChange={(e) => onCampo("resumen", e.target.value)} />
          <p className="ayuda contador">{contador(campos.resumen, 100, 300)}</p>
        </div>
        <CampoArchivo id="paper" titulo={t("paper")} ayuda={t("pdf_maximo_35_cuartillas")} rol="paper" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <CampoArchivo id="anexos" titulo={t("anexos_opcional")} ayuda={t("hasta_3_archivos_pdf")} rol="anexo" accept="application/pdf" maximo={3} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        {repo}
      </>
    );
  }

  if (seccion === "Horizonte Global") {
    return (
      <>
        <div className="campo">
          <label htmlFor="resumenHorizonte">{t("resumen_horizonte")}</label>
          <textarea id="resumenHorizonte" rows={7} value={campos.resumen} onChange={(e) => onCampo("resumen", e.target.value)} />
          <p className="ayuda contador">{contador(campos.resumen, null, 200)}</p>
        </div>
        <CampoArchivo id="articulo" titulo={t("articulo")} ayuda={t("pdf_800_a_1500_palabras_incluir_graficas_en_el_p_f838")} rol="articulo" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
      </>
    );
  }

  if (seccion === "¿Sabías Qué?") {
    return (
      <>
        <div className="campo">
          <label htmlFor="dato">{t("dato")}</label>
          <textarea id="dato" rows={7} value={campos.dato} onChange={(e) => onCampo("dato", e.target.value)} />
          <p className="ayuda contador">{contador(campos.dato, null, 200)}</p>
        </div>
        <CampoArchivo id="imagenSabias" titulo={t("imagen_opcional")} ayuda={t("maximo_1_imagen_jpg_png_o_webp")} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
      </>
    );
  }

  if (seccion === "Capital Social") {
    return (
      <>
        <div className="campo">
          <label htmlFor="cronicaCapital">{t("cronica")}</label>
          <textarea id="cronicaCapital" rows={9} value={campos.cronica} onChange={(e) => onCampo("cronica", e.target.value)} />
          <p className="ayuda contador">{contador(campos.cronica, 500, 900)}</p>
        </div>
        <CampoArchivo id="fotosCapital" titulo={t("foto")} ayuda={t("de_1_a_4_imagenes_jpg_png_o_webp")} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={4} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <div className="campo">
          <label htmlFor="piesImagen">{t("pies_de_imagen")}</label>
          <textarea id="piesImagen" rows={4} placeholder={t("en_orden_separados_por_coma")} value={campos.piesImagen} onChange={(e) => onCampo("piesImagen", e.target.value)} />
        </div>
      </>
    );
  }

  if (seccion === "Excelencia en Acción") {
    return (
      <>
        <div className="campo">
          <label htmlFor="semblanzaExcelencia">{t("semblanza")}</label>
          <textarea id="semblanzaExcelencia" rows={6} placeholder={t("semestre_logro_historia_breve_etc")} value={campos.semblanza} onChange={(e) => onCampo("semblanza", e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="cronicaExcelencia">{t("cronica")}</label>
          <textarea id="cronicaExcelencia" rows={8} placeholder={t("como_consiguio_la_oportunidad_cuales_fueron_los_d695")} value={campos.cronica} onChange={(e) => onCampo("cronica", e.target.value)} />
        </div>
        <CampoArchivo id="fotoExcelencia" titulo={t("foto_suya")} ayuda={t("1_imagen_jpg_png_o_webp")} rol="foto" accept="image/jpeg,image/png,image/webp" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <CampoArchivo id="cesionExcelencia" titulo={t("cesion_de_derechos_de_imagen_llenada_y_firmada")} ayuda="PDF" rol="cesion_imagen" accept="application/pdf" maximo={1} archivos={archivos} onArchivos={onArchivos} onQuitar={onQuitar} />
        <p className="ayuda enlace-documento"><a href={CESION} target="_blank" rel="noopener noreferrer">{t("cesion_de_derechos_de_imagen")}</a></p>
      </>
    );
  }

  return <p className="ayuda">{t("selecciona_una_seccion_en_el_paso_de_autoria")}</p>;
}
