import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { bitacora, cuerpoJson, huellaIp, json, type Bitacora } from "@/lib/api/peticion";
import { catalogos } from "@/lib/datos/catalogos";
import { tipoDeSeccion, esRolArchivo, type RolArchivo } from "@/lib/datos/portal-envios";
import { reconocer, MIME, type Formato } from "@/lib/archivos/formato";
import { limpiar } from "@/lib/archivos/limpiar";
import type { MedidaImagen } from "@/lib/archivos/imagen";
import { enviarAcuse } from "@/lib/correo/acuse";
import { guardarContacto } from "@/lib/correo/contacto";
import {
  validarEnvio,
  vacio,
  AVISO,
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

type ArchivoEntrante = { path: string; nombre: string; bytes: number; rol: RolArchivo };

function formatoPermitido(rol: RolArchivo, formato: Formato): boolean {
  if (rol === "foto" || rol === "visualizacion") return IMAGENES.has(formato);
  return formato === "pdf";
}

/**
 * Un fallo de red contra Storage es casi siempre transitorio, así que la copia
 * limpia se reintenta una vez. Más de uno no se justifica a este volumen —unas
 * decenas de envíos al año— y alargaría una petición que ya tiene 60 segundos
 * de techo. Si la segunda también falla, quien llama sigue adelante con el
 * original en vez de perder el envío.
 */
async function subirCopiaLimpia(
  sb: ReturnType<typeof servidor>,
  path: string,
  bytes: Uint8Array,
  mime: string,
  log: Bitacora,
): Promise<boolean> {
  for (let intento = 1; intento <= 2; intento++) {
    const { error } = await sb.storage
      .from(BUCKET_PRIVADO)
      .upload(path, bytes, { contentType: mime, cacheControl: "0" });
    if (!error) return true;
    log.error("resubida_fallida", { path, intento, error: error.message });
  }
  return false;
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
      medida?: MedidaImagen;
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
      if (IMAGENES.has(formato) && !limpieza.limpio) {
        log.error("imagen_no_optimizada", { nombre: a.nombre, motivo: limpieza.motivo });
      }

      const limpioPath = randomUUID();
      const guardada = await subirCopiaLimpia(sb, limpioPath, limpieza.bytes, MIME[formato], log);

      // Si la copia limpia no se pudo guardar, el envío sigue adelante con el
      // archivo original, que ya está en el bucket. Es seguro: el defecto que
      // motivó `20260821130300_ruta_limpia.sql` era escribir la copia limpia
      // ENCIMA de la sucia y que el CDN siguiera sirviendo la sucia cacheada
      // desde esa misma ruta; una ruta que nunca se reescribió no tiene ese
      // problema. Lo que sí sería un defecto es lo que pasaba antes: un fallo
      // de red contra Storage a mitad del bucle devolvía un error sin folio y
      // dejaba huérfanos los archivos ya subidos, o sea el envío perdido.
      const guardado = guardada ? limpioPath : a.path;

      // El original sólo se borra si hay copia que lo sustituya.
      if (guardada) {
        const { error: eBorrado } = await sb.storage.from(BUCKET_PRIVADO).remove([a.path]);
        if (eBorrado) log.error("borrado_original_fallido", { path: a.path, error: eBorrado.message });
      }

      preparados.push({
        subida_path: a.path,
        storage_path: guardado,
        nombre_original: a.nombre,
        mime: MIME[formato],
        bytes: guardada ? limpieza.bytes.byteLength : crudos.byteLength,
        rol: a.rol,
        limpio: guardada && limpieza.limpio,
        motivo: guardada
          ? limpieza.motivo
          : "no se pudo guardar la copia limpia; queda el archivo tal como se subió",
        // La medida describe la copia optimizada: si no se guardó, no hay nada
        // que medir y contarla inflaría la reducción que se vigila.
        medida: guardada ? limpieza.medida : undefined,
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

    // Lo que el optimizador de imágenes ahorró de verdad, archivo por archivo.
    // Sin esto, el 70-85 % de reducción que justifica no conservar los
    // originales sería una suposición, y un optimizador que empezara a fallar
    // en todas las fotos se vería igual que uno que funciona. `envio_eventos`
    // acepta cualquier `tipo`, así que no hace falta migración. Cómo mirarlo:
    // `docs/operacion.md §4`.
    const medidas = preparados.flatMap((p) =>
      p.medida ? [{ path: p.storage_path, rol: p.rol, ...p.medida }] : [],
    );
    if (medidas.length) {
      await sb.from("envio_eventos").insert({
        envio_id: creado.id,
        tipo: "imagen_optimizada",
        payload: { archivos: medidas },
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
