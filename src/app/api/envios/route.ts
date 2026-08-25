import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { bitacora, cuerpoJson, huellaIp, json } from "@/lib/api/peticion";
import { catalogos } from "@/lib/datos/catalogos";
import { tipoDeSeccion, esRolArchivo, type RolArchivo } from "@/lib/datos/portal-envios";
import { reconocer, MIME, type Formato } from "@/lib/archivos/formato";
import { limpiar } from "@/lib/archivos/limpiar";
import { enviarAcuse } from "@/lib/correo/acuse";
import { guardarContacto } from "@/lib/correo/contacto";
import {
  validarEnvio,
  vacio,
  MAX_ARCHIVOS,
  MAX_BYTES,
  MAX_BYTES_TOTAL,
  type DatosEnvio,
} from "@/lib/validacion";
import { LOCALES, LOCALE_POR_DEFECTO } from "@/i18n/rutas";
import type { RespuestaCrearEnvio } from "@/lib/supabase/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IMAGENES = new Set<Formato>(["jpeg", "png", "webp"]);

const AVISO = {
  limite: "demasiados_intentos",
  servidor: "no_pudimos_registrar_tu_envio",
  archivos: "puedes_adjuntar_como_maximo_5_archivos",
  total: "entre_todos_los_archivos_se_pasan_de_50_mb",
  formato: "portal_archivo_tipo",
  subida: "no_pudimos_subir_a",
  paginas: "portal_miradas_paper_max_35_paginas",
} as const;

type ArchivoEntrante = { path: string; nombre: string; bytes: number; rol: RolArchivo };

function formatoPermitido(rol: RolArchivo, formato: Formato): boolean {
  if (rol === "foto" || rol === "visualizacion") return IMAGENES.has(formato);
  return formato === "pdf";
}

function resumenEditorial(d: DatosEnvio): string {
  switch (d.seccion) {
    case "Datanomics": return d.campos.textoExplicativo.trim();
    case "La Voz de la Experiencia": return d.campos.semblanza.trim();
    case "Miradas Económicas": return d.campos.resumen.trim();
    case "Horizonte Global": return d.campos.resumen.trim();
    case "¿Sabías Qué?": return d.campos.dato.trim();
    case "Capital Social": return d.campos.cronica.trim();
    case "Excelencia en Acción": return `${d.campos.semblanza.trim()}\n\n${d.campos.cronica.trim()}`.trim();
    default: return "";
  }
}

export async function POST(req: Request) {
  const log = bitacora("POST /api/envios");
  const ip = huellaIp(req);
  const sb = servidor();

  try {
    const cuerpo = (await cuerpoJson(req)) as
      | { datos?: Partial<DatosEnvio>; archivos?: ArchivoEntrante[]; locale?: string }
      | null;

    if (!cuerpo?.datos || !Array.isArray(cuerpo.archivos)) {
      return json({ aviso: AVISO.servidor }, 400);
    }

    const { data: permitido, error: eLimite } = await sb.rpc("limitar", {
      p_clave: `envio:${ip}`,
      p_segundos: 3600,
      p_max: 10,
    });
    if (eLimite) {
      log.error("rpc_limitar", { error: eLimite.message });
      return json({ aviso: AVISO.servidor }, 500);
    }
    if (!permitido) return json({ aviso: AVISO.limite }, 429);

    const datos: DatosEnvio = {
      ...vacio,
      ...cuerpo.datos,
      campos: { ...vacio.campos, ...(cuerpo.datos.campos ?? {}) },
    };
    const archivos = cuerpo.archivos.filter(
      (a): a is ArchivoEntrante =>
        typeof a?.path === "string" && UUID.test(a.path) &&
        typeof a?.nombre === "string" &&
        typeof a?.bytes === "number" && a.bytes > 0 && a.bytes <= MAX_BYTES &&
        typeof a?.rol === "string" && esRolArchivo(a.rol),
    );

    if (archivos.length !== cuerpo.archivos.length || archivos.length > MAX_ARCHIVOS) {
      return json({ aviso: AVISO.archivos }, 400);
    }
    if (archivos.reduce((s, a) => s + a.bytes, 0) > MAX_BYTES_TOTAL) {
      return json({ aviso: AVISO.total }, 400);
    }

    const invalido = validarEnvio(
      datos,
      archivos.map((a) => ({ name: a.nombre, size: a.bytes, rol: a.rol })),
    );
    if (invalido) {
      log.info("invalido", { aviso: invalido.clave });
      return json({ aviso: invalido.clave, valores: invalido.valores }, 400);
    }

    const cat = await catalogos();
    const seccionId = cat.secciones.get(datos.seccion.trim());
    const tipoNombre = tipoDeSeccion(datos.seccion.trim());
    const tipoId = tipoNombre ? cat.tipos.get(tipoNombre) : null;
    const temaId = cat.temas.get(datos.tema.trim());

    if (!seccionId || !tipoId) {
      log.error("catalogo_no_resuelve", { seccion: datos.seccion, tipo: tipoNombre });
      return json({ aviso: AVISO.servidor }, 400);
    }

    const preparados: {
      subida_path: string;
      storage_path: string;
      nombre_original: string;
      mime: string;
      bytes: number;
      rol: RolArchivo;
      limpio: boolean;
      motivo?: string;
    }[] = [];

    for (const a of archivos) {
      const { data: blob, error } = await sb.storage.from(BUCKET_PRIVADO).download(a.path);
      if (error || !blob) {
        log.error("descarga_fallida", { path: a.path, error: error?.message });
        return json({ aviso: AVISO.subida, valores: { a: a.nombre } }, 400);
      }

      const crudos = new Uint8Array(await blob.arrayBuffer());
      const formato = reconocer(crudos);
      if (!formato || !formatoPermitido(a.rol, formato)) {
        log.info("formato_rechazado", { nombre: a.nombre, rol: a.rol, formato });
        return json({ aviso: AVISO.formato }, 400);
      }

      if (a.rol === "paper") {
        try {
          const pdf = await PDFDocument.load(crudos, { ignoreEncryption: true });
          if (pdf.getPageCount() > 35) return json({ aviso: AVISO.paginas }, 400);
        } catch {
          return json({ aviso: AVISO.formato }, 400);
        }
      }

      const limpieza = await limpiar(crudos, formato);
      const limpioPath = randomUUID();
      const { error: eSubida } = await sb.storage
        .from(BUCKET_PRIVADO)
        .upload(limpioPath, limpieza.bytes, {
          contentType: MIME[formato],
          cacheControl: "0",
        });

      if (eSubida) {
        log.error("resubida_fallida", { path: limpioPath, error: eSubida.message });
        return json({ aviso: AVISO.subida, valores: { a: a.nombre } }, 500);
      }

      const { error: eBorrado } = await sb.storage.from(BUCKET_PRIVADO).remove([a.path]);
      if (eBorrado) log.error("borrado_original_fallido", { path: a.path, error: eBorrado.message });

      preparados.push({
        subida_path: a.path,
        storage_path: limpioPath,
        nombre_original: a.nombre,
        mime: MIME[formato],
        bytes: limpieza.bytes.byteLength,
        rol: a.rol,
        limpio: limpieza.limpio,
        motivo: limpieza.motivo,
      });
    }

    const locale = LOCALES.includes(cuerpo.locale as never)
      ? (cuerpo.locale as string)
      : LOCALE_POR_DEFECTO;

    const { data: crudo, error: eCrear } = await sb.rpc("crear_envio", {
      p: {
        titulo: datos.titulo.trim(),
        tipo_pieza_id: tipoId,
        seccion_id: seccionId,
        tema_id: temaId ?? null,
        resumen: resumenEditorial(datos),
        palabras_clave: datos.claves.split(",").map((s) => s.trim()).filter(Boolean),
        uso_ia: datos.usoIA,
        locale,
        datos_seccion: datos.campos,
        autoria: {
          nombre: datos.nombre.trim(),
          correo: datos.correo.trim().toLowerCase(),
          afiliacion: datos.afiliacion.trim(),
          coautores: datos.coautores.trim(),
          genero: datos.genero.trim(),
        },
        declaraciones: {
          d1: datos.d1, d2: datos.d2, d3: datos.d3, d4: datos.d4,
          d5: datos.d5, d6: datos.d6, perfil: datos.perfil,
          version: VERSION_DECLARACIONES,
        },
        archivos: preparados.map(({ subida_path, storage_path, nombre_original, mime, bytes, rol }) => ({
          subida_path, storage_path, nombre_original, mime, bytes, rol,
        })),
      },
    });

    const creado = crudo as RespuestaCrearEnvio | null;
    if (eCrear || !creado?.folio) {
      const deCliente = eCrear?.code === "23514";
      log[deCliente ? "info" : "error"]("crear_envio_fallo", { error: eCrear?.message, code: eCrear?.code });
      return json({ aviso: AVISO.servidor }, deCliente ? 400 : 500);
    }

    const folio = creado.folio;
    log.conFolio(folio);
    log.info("registrado", { nivel: creado.nivel, archivos: preparados.length, seccion: datos.seccion });

    const sucios = preparados.filter((p) => !p.limpio);
    if (sucios.length) {
      await sb.from("envio_eventos").insert({
        envio_id: creado.id,
        tipo: "metadatos_no_limpiados",
        payload: { archivos: sucios.map((s) => ({ path: s.storage_path, rol: s.rol, motivo: s.motivo })) },
      });
    }

    const contacto = await guardarContacto(datos.correo.trim().toLowerCase(), datos.nombre.trim());
    if (!contacto.guardado) {
      log.error("contacto_resend_no_guardado", { motivo: contacto.motivo });
      await sb.from("envio_eventos").insert({
        envio_id: creado.id,
        tipo: "contacto_resend_no_guardado",
        payload: { motivo: contacto.motivo ?? "desconocido" },
      });
    }

    const origen = new URL(req.url).origin;
    const acuse = await enviarAcuse({
      a: datos.correo.trim(),
      nombre: datos.nombre.trim(),
      folio,
      titulo: datos.titulo.trim(),
      seccion: datos.seccion,
      genero: datos.genero,
      locale,
      origen,
    });

    if (!acuse.enviado) {
      log.error("acuse_no_enviado", { motivo: acuse.motivo });
      await sb.from("envio_eventos").insert({
        envio_id: creado.id,
        tipo: "acuse_no_enviado",
        payload: { motivo: acuse.motivo ?? "desconocido" },
      });
    }

    return json({ folio, acuse: acuse.enviado });
  } catch (e) {
    log.error("excepcion", { error: (e as Error).message });
    return json({ aviso: AVISO.servidor }, 500);
  }
}

const VERSION_DECLARACIONES = "2026-08-25";
