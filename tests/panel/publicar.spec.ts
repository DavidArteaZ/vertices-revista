import { test, expect, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import {
  monta,
  desmonta,
  preparaParaPublicar,
  urlPrivadaSinFirmar,
  CLAVE,
  type Escenario,
} from "./fixture";

/**
 * Publicar un número, de principio a fin (spec §9).
 *
 * Lo que hay que demostrar no es que el botón funcione, sino las dos promesas
 * que lo rodean:
 *
 *   · Mientras la edición está en borrador, la pieza NO existe para el
 *     público, ni siquiera sabiendo su slug. Eso lo decide la política de
 *     `articulos`, que mira el estado de su edición.
 *   · El manuscrito del bucket privado no se alcanza adivinando la URL, ni
 *     antes ni después de publicar. Lo que se hace público es una COPIA en
 *     otro bucket, no el original.
 */

const NUMERO = 901;
const PIEZA_TITULO = "Una gráfica de prueba sólo con título";

let e: Escenario;
let manuscrito: string;
let slugEsperado: string;
let pdfBytes: Uint8Array;

test.beforeAll(async () => {
  e = await monta();

  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save({ useObjectStreams: false });
  pdfBytes = bytes;

  const preparado = await preparaParaPublicar(e, bytes);
  manuscrito = preparado.storagePath;

  const { data } = await e.admin.from("envios").select("titulo").eq("id", e.envioId).single();
  slugEsperado = data!.titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
});

test.afterAll(async () => { if (e) await desmonta(e); });

async function entra(page: Page) {
  await page.goto("/panel/entrar");
  await page.fill("#correo", e.ana.correo);
  await page.fill("#clave", CLAVE);
  await page.click("button[type=submit]");
  await page.waitForURL("**/panel");
}

test("un número se arma, se publica y sólo entonces es visible", async ({ page, request }) => {
  page.on("dialog", (d) => d.accept());
  await entra(page);

  // ------------------------------------------------------- crear el número
  await page.goto("/panel/ediciones");
  await page.fill("#numero", String(NUMERO));
  await page.fill("#titulo", "Número de prueba");
  await page.click('form:has(#numero) button[type=submit]');
  await expect(page.getByRole("cell", { name: String(NUMERO) })).toBeVisible();

  await page.getByRole("link", { name: String(NUMERO) }).click();
  await page.waitForURL("**/panel/ediciones/**");

  // ------------------------------------------------------- colgarle la pieza
  await page.selectOption("#envio", { index: 1 });
  await page.fill("#minutos", "7");
  await page.click('form:has(#envio) button[type=submit]');
  // Las piezas van agrupadas por sección y cada sección está plegada.
  await page.locator("summary", { hasText: "Miradas Económicas" }).click();
  await expect(page.getByRole("cell", { name: "Nombre Del Autor Secreto" })).toBeVisible({ timeout: 30_000 });

  // ------------------------------- una pieza por título en otra sección
  // Las secciones que no se dictaminan reciben piezas con sólo su título;
  // no son artículos y no necesitan PDF para publicar.
  const datanomics = page.locator("details", { has: page.locator("summary", { hasText: "Datanomics" }) });
  await datanomics.locator("summary").click();
  await datanomics.locator('input[name="titulo"]').fill(PIEZA_TITULO);
  await datanomics.locator('button:has-text("Agregar pieza")').click();
  await expect(datanomics.getByText(PIEZA_TITULO)).toBeVisible({ timeout: 30_000 });

  // ------------------------------- en borrador, el público no ve nada de esto
  const enBorrador = await request.get(`/articulos/${slugEsperado}`);
  expect(enBorrador.status()).toBe(404);

  // Y el manuscrito privado tampoco se alcanza adivinando la ruta.
  const privado = await request.get(urlPrivadaSinFirmar(manuscrito));
  expect(privado.ok()).toBe(false);

  // La página del número tampoco existe todavía.
  expect((await request.get(`/ediciones/${NUMERO}`)).status()).toBe(404);

  // ------------------------------------------- sin PDF final no se publica
  await page.click('button:has-text("Publicar el número")');
  await expect(page.getByText(/Falta el PDF de la edición final/)).toBeVisible({ timeout: 30_000 });

  // El PDF final se sube aparte y no toca el PDF de la pieza: su enlace es el
  // mismo antes y después, que es lo que mantiene vivos los QR impresos.
  const pdfPiezaAntes = await page.getByRole("link", { name: "Ver PDF", exact: true }).getAttribute("href");
  await page.setInputFiles('input[aria-label="PDF de la edición final"]', {
    name: "numero-completo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(pdfBytes),
  });
  await page.click('button:has-text("Subir PDF final")');
  await expect(page.getByText("PDF de la edición final actualizado.")).toBeVisible({ timeout: 60_000 });
  expect(await page.getByRole("link", { name: "Ver PDF", exact: true }).getAttribute("href")).toBe(pdfPiezaAntes);

  // --------------------------------------------------------------- publicar
  await page.click('button:has-text("Publicar el número")');
  // Al publicar, la sección entera desaparece —ya no hay nada que publicar— y
  // se lleva su aviso. Lo que se afirma es el estado resultante.
  await expect(page.getByText(/Publicada el/)).toBeVisible({ timeout: 60_000 });

  // ------------------------------------------------- ahora sí, y con su PDF
  const publicada = await request.get(`/articulos/${slugEsperado}`);
  expect(publicada.status()).toBe(200);

  // Las afirmaciones de CONTENIDO van contra lo renderizado, no contra el HTML
  // crudo: NextIntlClientProvider serializa el catálogo entero de mensajes en
  // la página, así que "Descargar el PDF" aparece en el HTML aunque no se
  // dibuje. Buscarlo ahí daría una prueba que pasa siempre.
  await page.goto(`/articulos/${slugEsperado}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Nombre Del Autor Secreto")).toBeVisible();
  await expect(page.getByRole("link", { name: "Descargar el PDF" })).toBeVisible();
  await expect(page.getByText(`Número ${NUMERO}`)).toBeVisible();

  // El PDF copiado se descarga sin credenciales: es el punto de publicarlo.
  const enlace = await page
    .getByRole("link", { name: "Descargar el PDF" })
    .getAttribute("href");
  expect(enlace).toContain("/publicaciones/");
  const pdf = await request.get(enlace!);
  expect(pdf.ok()).toBe(true);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // El original sigue sin ser alcanzable: lo público es la copia.
  const siguePrivado = await request.get(urlPrivadaSinFirmar(manuscrito));
  expect(siguePrivado.ok()).toBe(false);

  // ------------------------------------------ la página del número completo
  await page.goto(`/ediciones/${NUMERO}`);
  await expect(page.getByRole("heading", { level: 1, name: "Número de prueba" })).toBeVisible();
  const pdfFinal = await page.getByRole("link", { name: "Abrir el PDF" }).getAttribute("href");
  expect(pdfFinal).toContain(`/publicaciones/`);
  expect((await request.get(pdfFinal!)).ok()).toBe(true);
  // Y enlaza a la pieza por su dirección de siempre.
  await expect(page.locator(`a[href="/articulos/${slugEsperado}"]`)).toHaveCount(1);
  // Y enseña las piezas por sección: la de título va en Datanomics, sin enlace.
  const seccionDatanomics = page.locator("section", { has: page.getByRole("heading", { name: "Datanomics" }) });
  await expect(seccionDatanomics.getByText(PIEZA_TITULO)).toBeVisible();
  await expect(seccionDatanomics.locator("a", { hasText: PIEZA_TITULO })).toHaveCount(0);
});

test("una pieza de muestra da página, pero sin PDF", async ({ page }) => {
  // §5.5: los 26 artículos de demostración existen para que el descubrimiento
  // funcione antes del primer número, y su página pinta un vacío definido en
  // vez de un enlace roto — que es lo que hay hoy (index.html:1942).
  const r = await page.goto("/articulos/la-inflacion-mexicana-contada-en-12-graficas");
  expect(r?.status()).toBe(200);

  await expect(page.getByText(/pieza de muestra/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Descargar el PDF" })).toHaveCount(0);
});

test("la portada lista los artículos que vienen de la base", async ({ page }) => {
  await page.goto("/");

  // El carrusel ya no lee un arreglo del código: esta pieza es destacada y
  // sale de public.articulos, con su enlace a la página de artículo.
  //
  // Se busca por selector y no por rol: el carrusel vive dentro del recorrido
  // del lienzo y no está visible al cargar, así que no aparece en el árbol de
  // accesibilidad. Lo que hay que comprobar es que el enlace se generó, no que
  // se vea — de que se vea ya responde la compuerta visual.
  const enlace = page.locator('a[href="/articulos/la-inflacion-mexicana-contada-en-12-graficas"]');
  await expect(enlace).toHaveCount(1);
  await expect(enlace).toContainText("La inflación mexicana contada en 12 gráficas");
});
