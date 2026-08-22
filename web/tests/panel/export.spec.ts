import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { monta, desmonta, CLAVE, type Escenario } from "./fixture";

/**
 * El export del Registro y el doble ciego (spec §12).
 *
 * «El export obedece §7 — las columnas de autoría van vacías en cualquier
 * envío del que quien exporta siga ciega, y cada export escribe una fila en
 * envio_eventos. Un export no es una forma de rodear el ciego.»
 *
 * Es la afirmación que más fácil sería incumplir sin enterarse: la pantalla
 * puede estar bien y el .xlsx traer la columna entera, porque lo genera otro
 * código. Aquí se descarga el archivo de verdad, se abre con exceljs y se mira
 * celda por celda.
 */

const AUTOR = "Nombre Del Autor Secreto";

let e: Escenario;

test.beforeAll(async () => { e = await monta(); });
test.afterAll(async () => { if (e) await desmonta(e); });

async function entra(page: Page, correo: string) {
  await page.goto("/panel/entrar");
  await page.fill("#correo", correo);
  await page.fill("#clave", CLAVE);
  await page.click("button[type=submit]");
  await page.waitForURL("**/panel");
}

/** Descarga el .xlsx con la sesión abierta en el navegador y lo abre. */
async function descargaRegistro(page: Page) {
  const r = await page.request.get("/panel/exportar");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("spreadsheetml");

  const wb = new ExcelJS.Workbook();
  // exceljs declara Buffer del propio Node; el que devuelve Playwright es un
  // Buffer<ArrayBufferLike> y TypeScript los distingue. Los bytes son los
  // mismos, así que se pasa el ArrayBuffer subyacente.
  const bytes = await r.body();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ws = wb.getWorksheet("Registro");
  expect(ws).toBeTruthy();

  const filas: string[][] = [];
  ws!.eachRow((fila) => {
    filas.push((fila.values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v))));
  });
  return { filas, texto: filas.flat().join("\n") };
}

test("el .xlsx respeta la ceguera de quien lo descarga", async ({ page }) => {
  await entra(page, e.ana.correo);

  // ------------------------------------------------------------ estando ciega
  const ciego = await descargaRegistro(page);

  // Los encabezados son los de la hoja Registro del libro, A a T.
  expect(ciego.filas[0]).toEqual([
    "Folio", "Título de la pieza", "Autor(es)", "Correo", "Filiación", "Género",
    "Sección", "¿Investigación / paper?", "Nivel", "Tipo de pieza",
    "Fecha de recepción", "Extensión", "Antiplagio (Turnitin)",
    "Uso de IA declarado", "Enlace al manuscrito", "Hoja de dictamen",
    "Puntaje", "Decisión", "Estado", "Notas",
  ]);

  const fila = ciego.filas.find((f) => f[0] === e.folio);
  expect(fila).toBeTruthy();

  // El manuscrito sí está: lo que se oculta es quién lo escribió.
  expect(fila![1]).toContain("Un manuscrito de prueba");

  // Y las columnas de autoría, no.
  expect(fila![2]).toBe("—"); // Autor(es)
  expect(fila![3]).toBe("—"); // Correo
  expect(fila![4]).toBe("—"); // Filiación
  expect(fila![19]).toBe("—"); // Notas

  // La comprobación que de verdad importa: el nombre no aparece en NINGUNA
  // celda de la hoja, no sólo en las que se miraron arriba.
  expect(ciego.texto).not.toContain(AUTOR);
  expect(ciego.texto).not.toContain(e.correoAutor);

  // ------------------------------------------- y con la decisión ya grabada
  const { data: decision } = await e.admin
    .from("decisiones")
    .select("id")
    .eq("es_aceptante", true)
    .limit(1)
    .single();

  await e.admin
    .from("envios")
    .update({
      decision_id: decision!.id,
      decision_final_por: e.ana.id,
      decision_final_at: new Date().toISOString(),
      estado: "decidido",
    })
    .eq("id", e.envioId);

  const abierto = await descargaRegistro(page);
  const filaAbierta = abierto.filas.find((f) => f[0] === e.folio);

  expect(filaAbierta![2]).toBe(AUTOR);
  expect(filaAbierta![3]).toBe(e.correoAutor);
  expect(filaAbierta![4]).toBe("Universidad de Prueba");
});

test("cada export deja constancia en la bitácora", async ({ page }) => {
  const antes = await e.admin
    .from("envio_eventos")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "export_generado");

  await entra(page, e.beto.correo);
  await descargaRegistro(page);

  const despues = await e.admin
    .from("envio_eventos")
    .select("id, actor_id, payload", { count: "exact" })
    .eq("tipo", "export_generado")
    .order("at", { ascending: false });

  expect(despues.count).toBe((antes.count ?? 0) + 1);

  // Quién lo pidió y cuántas filas salieron cegadas: la prueba de que el
  // export respetó el ciego de ESA persona, y no el de otra.
  const ultimo = despues.data![0];
  expect(ultimo.actor_id).toBe(e.beto.id);

  // El número esperado se calcula, no se adivina: envíos sin decisión de los
  // que Beto no haya enviado dictamen. Así la afirmación vale sin importar en
  // qué orden corran las pruebas ni qué haya dejado la anterior.
  const { data: todos } = await e.admin.from("envios").select("id, decision_id");
  const { data: suyos } = await e.admin
    .from("dictamenes")
    .select("envio_id")
    .eq("revisor_id", e.beto.id)
    .eq("estado", "enviado");
  const dictaminados = new Set((suyos ?? []).map((d) => d.envio_id));
  const esperados = (todos ?? []).filter((x) => !x.decision_id && !dictaminados.has(x.id)).length;

  expect((ultimo.payload as { cegados: number }).cegados).toBe(esperados);
});

test("sin sesión no hay export", async ({ request }) => {
  const r = await request.get("/panel/exportar", { maxRedirects: 0 });
  expect(r.status()).toBeGreaterThanOrEqual(300);
  expect(r.status()).toBeLessThan(400);
});
