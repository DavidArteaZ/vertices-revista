import { randomUUID } from "node:crypto";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { bitacora, cuerpoJson, huellaIp, json } from "@/lib/api/peticion";
import { catalogos } from "@/lib/datos/catalogos";
import { reconocer, MIME } from "@/lib/archivos/formato";
import { limpiar } from "@/lib/archivos/limpiar";
import { enviarAcuse } from "@/lib/correo/acuse";
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

/**
 * Registrar un envío (spec §8).
 *
 * Lo que este endpoint NO tiene es el respaldo del sitio actual, que ante un
 * fallo de escritura inventaba un folio y enseñaba la pantalla de éxito
 * (index.html:2172-2175). Es el defecto que motivó toda la reescritura: el
 * autor se iba tranquilo y el manuscrito no existía en ninguna parte. Aquí, o
 * hay folio o hay error.
 *
 * El orden importa. Los archivos se limpian ANTES de crear la fila, porque un
 * archivo que no se puede leer o que no es lo que dice ser tiene que impedir
 * el envío; y la fila se crea ANTES de mandar el correo, porque el correo
 * puede fallar sin que eso vuelva inválido el registro.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Descargar, reescribir y volver a subir hasta cinco archivos de 20 MB no cabe
// en el tiempo de una función por omisión.
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const AVISO = {
  limite: "demasiados_intentos",
  servidor: "no_pudimos_registrar_tu_envio",
  archivos: "puedes_adjuntar_como_maximo_5_archivos",
  total: "entre_todos_los_archivos_se_pasan_de_50_mb",
  formato: "a_no_es_un_pdf_ni_un_documento_de_word",
  subida: "no_pudimos_subir_a",
} as const;

type ArchivoEntrante = { path: string; nombre: string; bytes: number };

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

    // El cupo se comprueba antes de tocar Storage: descargar y reescribir
    // cinco archivos es la parte cara y no debe poder provocarse en bucle.
    const { data: permitido, error: eLimite } = await sb.rpc("limitar", {
      p_clave: `envio:${ip}`,
      p_segundos: 3600,
      p_max: 10,
    });
    if (eLimite) {
      log.error("rpc_limitar", { error: eLimite.message });
      return json({ aviso: AVISO.servidor }, 500);
    }
    if (!permitido) {
      log.info("limitado");
      return json({ aviso: AVISO.limite }, 429);
    }

    // ------------------------------------------------------------- validación
    // Las mismas reglas que el asistente, aplicadas donde no se pueden saltar.
    const datos: DatosEnvio = { ...vacio, ...cuerpo.datos };
    const archivos = cuerpo.archivos.filter(
      (a): a is ArchivoEntrante =>
        typeof a?.path === "string" &&
        UUID.test(a.path) &&
        typeof a?.nombre === "string" &&
        typeof a?.bytes === "number" &&
        a.bytes > 0 &&
        a.bytes <= MAX_BYTES,
    );

    if (archivos.length !== cuerpo.archivos.length || archivos.length > MAX_ARCHIVOS) {
      return json({ aviso: AVISO.archivos }, 400);
    }
    if (archivos.reduce((s, a) => s + a.bytes, 0) > MAX_BYTES_TOTAL) {
      return json({ aviso: AVISO.total }, 400);
    }

    const invalido = validarEnvio(
      datos,
      archivos.map((a) => ({ name: a.nombre, size: a.bytes })),
    );
    if (invalido) {
      log.info("invalido", { aviso: invalido.clave });
      return json({ aviso: invalido.clave, valores: invalido.valores }, 400);
    }

    // ------------------------------------------------------------- catálogos
    const cat = await catalogos();
    const seccionId = cat.secciones.get(datos.seccion.trim());
    const tipoId = cat.tipos.get(datos.formato.trim());
    const temaId = cat.temas.get(datos.tema.trim());

    if (!seccionId || !tipoId) {
      log.error("catalogo_no_resuelve", { seccion: datos.seccion, tipo: datos.formato });
      return json({ aviso: AVISO.servidor }, 400);
    }

    // -------------------------------------------------- formato y metadatos
    // Aquí es donde el servidor ve los bytes por primera vez: la subida fue
    // directa del navegador a Storage. Por eso el reconocimiento de formato y
    // la limpieza viven en esta ruta y no en /api/uploads.
    const preparados: {
      /** La ruta firmada. Es el ticket que crear_envio valida y consume. */
      subida_path: string;
      /** Donde vive el archivo ya limpio. Es la que se guarda. */
      storage_path: string;
      nombre_original: string;
      mime: string;
      bytes: number;
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
      if (!formato) {
        log.info("formato_rechazado", { nombre: a.nombre });
        return json({ aviso: AVISO.formato, valores: { a: a.nombre } }, 400);
      }

      const limpieza = await limpiar(crudos, formato);

      // El limpio va a una ruta NUEVA, no encima de la sucia. Sobrescribir
      // parecía lo natural y es lo que estaba escrito, hasta que la prueba de
      // extremo a extremo descargó el original con el nombre del autor dentro
      // mientras el objeto del bucket ya estaba limpio: entre la subida del
      // navegador y esta reescritura pasan segundos, y en esos segundos la
      // ruta ya se puede pedir y el CDN se queda la copia sucia. Una ruta que
      // nunca se sirvió sucia no se puede cachear sucia.
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

      // El sucio se va. Si el borrado falla no se aborta el envío —el archivo
      // bueno ya está— y lo recoge el barrido de huérfanos, que mira el bucket
      // y no el registro de tickets justamente para cubrir estos casos.
      const { error: eBorrado } = await sb.storage.from(BUCKET_PRIVADO).remove([a.path]);
      if (eBorrado) log.error("borrado_original_fallido", { path: a.path, error: eBorrado.message });

      preparados.push({
        subida_path: a.path,
        storage_path: limpioPath,
        nombre_original: a.nombre,
        mime: MIME[formato],
        bytes: limpieza.bytes.byteLength,
        limpio: limpieza.limpio,
        motivo: limpieza.motivo,
      });
    }

    // ------------------------------------------------------------ el registro
    const locale = LOCALES.includes(cuerpo.locale as never)
      ? (cuerpo.locale as string)
      : LOCALE_POR_DEFECTO;

    const { data: crudo, error: eCrear } = await sb.rpc("crear_envio", {
      p: {
        titulo: datos.titulo.trim(),
        tipo_pieza_id: tipoId,
        seccion_id: seccionId,
        tema_id: temaId ?? null,
        resumen: datos.resumen.trim(),
        palabras_clave: datos.claves.split(",").map((s) => s.trim()).filter(Boolean),
        uso_ia: datos.usoIA,
        locale,
        autoria: {
          nombre: datos.nombre.trim(),
          correo: datos.correo.trim().toLowerCase(),
          afiliacion: datos.afiliacion.trim(),
          coautores: datos.coautores.trim(),
          genero: datos.genero.trim(),
        },
        // §8: las cuatro declaraciones se guardan, con la versión del texto
        // que el autor aceptó. d4 es la licencia de publicación y §9 copia el
        // PDF a un bucket público; tiene que existir constancia.
        declaraciones: {
          d1: datos.d1,
          d2: datos.d2,
          d3: datos.d3,
          d4: datos.d4,
          perfil: datos.perfil,
          version: VERSION_DECLARACIONES,
        },
        archivos: preparados.map(
          ({ subida_path, storage_path, nombre_original, mime, bytes }) => ({
            subida_path,
            storage_path,
            nombre_original,
            mime,
            bytes,
          }),
        ),
      },
    });

    const creado = crudo as RespuestaCrearEnvio | null;

    if (eCrear || !creado?.folio) {
      // 23514 es check_violation, que es como crear_envio rechaza una ruta de
      // Storage que este servidor no firmó o que ya se usó. Eso es culpa de
      // quien pide, no una avería: devolverlo como 5xx haría saltar la alerta
      // de §15 sobre algo que no es una incidencia, y §15 sólo sirve si sus
      // alertas significan siempre lo mismo.
      const deCliente = eCrear?.code === "23514";
      log[deCliente ? "info" : "error"]("crear_envio_fallo", {
        error: eCrear?.message,
        code: eCrear?.code,
      });
      return json({ aviso: AVISO.servidor }, deCliente ? 400 : 500);
    }

    const folio = creado.folio;
    log.conFolio(folio);
    log.info("registrado", { nivel: creado.nivel, archivos: preparados.length });

    // Que un archivo no se pudiera limpiar no impide el envío, pero sí tiene
    // que llegar a quien revisa la anonimización.
    const sucios = preparados.filter((p) => !p.limpio);
    if (sucios.length) {
      log.info("metadatos_no_limpiados", { n: sucios.length });
      await sb.from("envio_eventos").insert({
        envio_id: creado.id,
        tipo: "metadatos_no_limpiados",
        payload: { archivos: sucios.map((s) => ({ path: s.storage_path, motivo: s.motivo })) },
      });
    }

    // ------------------------------------------------------------ el acuse
    const origen = new URL(req.url).origin;
    const acuse = await enviarAcuse({
      a: datos.correo.trim(),
      nombre: datos.nombre.trim(),
      folio,
      titulo: datos.titulo.trim(),
      locale,
      origen,
    });

    if (!acuse.enviado) {
      // No se le devuelve error al autor: el envío está guardado y decirle que
      // falló sólo conseguiría que lo mandara otra vez.
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

/**
 * Versión del texto de las declaraciones. Se guarda junto a los cuatro
 * booleanos porque "el autor aceptó" no significa nada sin saber qué aceptó, y
 * el texto va a cambiar. Súbela cuando cambie la redacción de las casillas.
 */
const VERSION_DECLARACIONES = "2026-08-21";
