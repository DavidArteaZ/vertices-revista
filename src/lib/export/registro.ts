import "server-only";
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";

/**
 * El export del Registro (spec §12).
 *
 * Reproduce la disposición de columnas de la hoja `Registro` del libro —A a T,
 * en el mismo orden— porque el comité lleva años leyéndola así y el export
 * existe para que puedan seguir haciéndolo. Es de sólo lectura: nada vuelve
 * desde el .xlsx a la base.
 *
 * LA CEGUERA NO SE REIMPLEMENTA AQUÍ. La consulta corre con la sesión de quien
 * exporta, así que `envios_autoria` ya llega filtrada por la política del
 * doble ciego: para un envío del que quien exporta sigue ciega, sencillamente
 * no hay fila, y las columnas de autoría salen vacías. Escribir aquí un `if`
 * sería tener dos implementaciones de la misma regla, y la de aquí sería la
 * que se olvidaría de actualizar.
 *
 * Por eso mismo el export no es una vía para rodear el ciego: exportar en masa
 * devuelve exactamente lo que la persona ya podía ver pantalla por pantalla.
 */

/** Columnas A–T de `Registro`, en su orden. */
const COLUMNAS = [
  { encabezado: "Folio", ancho: 16 },
  { encabezado: "Título de la pieza", ancho: 46 },
  { encabezado: "Autor(es)", ancho: 26 },
  { encabezado: "Correo", ancho: 28 },
  { encabezado: "Filiación", ancho: 26 },
  { encabezado: "Género", ancho: 12 },
  { encabezado: "Sección", ancho: 22 },
  { encabezado: "¿Investigación / paper?", ancho: 20 },
  { encabezado: "Nivel", ancho: 8 },
  { encabezado: "Tipo de pieza", ancho: 20 },
  { encabezado: "Fecha de recepción", ancho: 18 },
  { encabezado: "Extensión", ancho: 18 },
  { encabezado: "Antiplagio (Turnitin)", ancho: 18 },
  { encabezado: "Uso de IA declarado", ancho: 18 },
  { encabezado: "Enlace al manuscrito", ancho: 34 },
  { encabezado: "Hoja de dictamen", ancho: 22 },
  { encabezado: "Puntaje", ancho: 10 },
  { encabezado: "Decisión", ancho: 30 },
  { encabezado: "Estado", ancho: 16 },
  { encabezado: "Notas", ancho: 40 },
] as const;

/** Las que la ceguera puede dejar vacías. Se marcan para que se note. */
const CEGABLES = new Set(["Autor(es)", "Correo", "Filiación", "Género", "Enlace al manuscrito", "Notas"]);

const OCULTO = "—";

export async function generaRegistro(
  sb: SupabaseClient<Database>,
): Promise<{ buffer: Buffer; filas: number; cegados: number }> {
  const [{ data: envios }, { data: secciones }, { data: tipos }, { data: decisiones }] =
    await Promise.all([
      sb.from("envios").select("*").order("folio"),
      sb.from("secciones").select("id, nombre_display"),
      sb.from("tipos_pieza").select("id, nombre"),
      sb.from("decisiones").select("id, etiqueta"),
    ]);

  const ids = (envios ?? []).map((e) => e.id);

  const [{ data: autorias }, { data: archivos }, { data: nombres }, { data: dictamenes }] =
    ids.length
      ? await Promise.all([
          sb.from("envios_autoria").select("*").in("envio_id", ids),
          sb.from("envio_archivos").select("id, envio_id, nombre_publico, es_principal").in("envio_id", ids),
          sb.from("envio_archivo_nombres").select("archivo_id, nombre_original"),
          sb.from("dictamenes").select("envio_id, estado, puntaje, maximo").in("envio_id", ids),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const seccion = new Map((secciones ?? []).map((s) => [s.id, s.nombre_display]));
  const tipo = new Map((tipos ?? []).map((t) => [t.id, t.nombre]));
  const decision = new Map((decisiones ?? []).map((d) => [d.id, d.etiqueta]));
  const autoria = new Map((autorias ?? []).map((a) => [a.envio_id, a]));
  const nombreOriginal = new Map((nombres ?? []).map((n) => [n.archivo_id, n.nombre_original]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Vértices";
  const ws = wb.addWorksheet("Registro");

  ws.columns = COLUMNAS.map((c) => ({ header: c.encabezado, width: c.ancho }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  let cegados = 0;

  for (const e of envios ?? []) {
    const quien = autoria.get(e.id);
    if (!quien) cegados++;

    const principal = (archivos ?? []).find((a) => a.envio_id === e.id && a.es_principal);
    // El nombre original delata igual que la autoría y está tras el mismo
    // predicado; cuando no llega, se cae al nombre que asigna la revista, que
    // es informativo y no dice nada de nadie.
    const manuscrito = principal
      ? (nombreOriginal.get(principal.id) ?? principal.nombre_publico)
      : OCULTO;

    const mios = (dictamenes ?? []).filter((d) => d.envio_id === e.id && d.estado === "enviado");
    const puntajes = mios
      .map((d) => (d.puntaje !== null && d.maximo !== null ? `${d.puntaje}/${d.maximo}` : null))
      .filter(Boolean)
      .join(" · ");

    ws.addRow([
      e.folio,
      e.titulo,
      quien?.nombre ?? OCULTO,
      quien?.correo ?? OCULTO,
      quien?.afiliacion ?? (quien ? "" : OCULTO),
      quien?.genero ?? (quien ? "" : OCULTO),
      seccion.get(e.seccion_id) ?? "",
      e.es_investigacion ? "Sí" : "No",
      e.nivel ?? "",
      e.tipo_pieza_id ? (tipo.get(e.tipo_pieza_id) ?? "") : "",
      new Date(e.created_at).toLocaleDateString("es-MX"),
      e.extension ?? "",
      e.antiplagio ?? "",
      e.uso_ia ?? "",
      manuscrito,
      mios.length ? `${mios.length} dictamen(es)` : "",
      puntajes,
      e.decision_id ? (decision.get(e.decision_id) ?? "") : "",
      e.estado,
      quien?.notas_internas ?? (quien ? "" : OCULTO),
    ]);
  }

  // Una nota al pie, no un pie de página: quien abra el archivo tiene que
  // entender por qué hay guiones donde esperaba nombres, o pensará que la base
  // está incompleta.
  ws.addRow([]);
  ws.addRow([
    `Generado el ${new Date().toLocaleString("es-MX")}. Las columnas de autoría aparecen como «${OCULTO}» ` +
      "en los envíos cuyo dictamen todavía no has enviado y que no tienen decisión registrada: " +
      "el export no es una forma de rodear el doble ciego.",
  ]);
  ws.lastRow!.font = { italic: true, size: 9 };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, filas: (envios ?? []).length, cegados };
}

export { CEGABLES, COLUMNAS };
