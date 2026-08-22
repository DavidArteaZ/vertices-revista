import { test, expect, type Page } from "@playwright/test";
import { monta, desmonta, CLAVE, type Escenario } from "./fixture";

/**
 * El doble ciego de §7.2, recorrido por el navegador.
 *
 * La suite de SQL demuestra que las políticas aguantan. Ésta demuestra que la
 * aplicación no las rodea: que ninguna pantalla del panel enseña por otro
 * camino lo que la política oculta, y que los dos disparadores de desvelado
 * hacen exactamente lo que dicen.
 *
 *   1. Ana entra y NO ve al autor, aunque esté asignada.
 *   2. Ana envía su dictamen → Ana ve al autor.
 *   3. Beto, que también está asignado, sigue sin verlo.
 *   4. Ana graba la decisión → Beto también lo ve.
 *
 * El nombre del autor se busca en el HTML entero de la página, no en un
 * selector: lo que hay que demostrar es que no está en ninguna parte.
 */

const AUTOR = "Nombre Del Autor Secreto";

let e: Escenario;

test.beforeAll(async () => { e = await monta(); });
test.afterAll(async () => { if (e) await desmonta(e); });

async function entra(page: Page, correo: string) {
  await page.goto("/panel/entrar");
  await page.fill("#correo", correo);
  await page.fill("#clave", CLAVE);
  await page.click('button[type=submit]');
  await page.waitForURL("**/panel");
}

async function sale(page: Page) {
  await page.click('button:has-text("Salir")');
  await page.waitForURL("**/panel/entrar");
}

test("la ceguera se levanta al enviar el dictamen, y sólo para quien lo envió", async ({ page }) => {
  // Las acciones irreversibles piden confirmación con window.confirm. Un solo
  // manejador para toda la prueba: con `once` por acción, dos quedan colgados
  // esperando el mismo diálogo y el segundo revienta.
  page.on("dialog", (d) => d.accept());

  // ---------------------------------------------------------------- 1. ciega
  await entra(page, e.ana.correo);
  await page.goto(`/panel/envios/${e.envioId}`);

  expect(await page.content()).not.toContain(AUTOR);
  expect(await page.content()).not.toContain(e.correoAutor);
  await expect(page.getByText("Oculta.")).toBeVisible();

  // Asignarse a sí misma. El selector de candidatos existe justamente para
  // esto y no hay nada que lo impida: estar asignada no es ver al autor.
  await page.selectOption("#revisor", { label: e.ana.nombre });
  await page.click('form:has(#revisor) button[type=submit]');
  // Se afirma sobre la fila, no sobre el mensaje: cuando ya no queda nadie a
  // quien asignar el formulario desaparece y se lleva su aviso consigo. La
  // tabla es la confirmación de verdad.
  //
  // Con margen: la acción va al servidor, revalida la ruta y vuelve a
  // renderizar. Los 5 s por defecto se quedan cortos en una máquina cargada, y
  // eso sale como un fallo que no lo es.
  await expect(page.getByRole("cell", { name: new RegExp(e.ana.nombre) })).toBeVisible({ timeout: 30_000 });

  // Sigue ciega después de asignarse.
  await page.reload();
  expect(await page.content()).not.toContain(AUTOR);

  // También hay que asignar a Beto, para el paso 3.
  await page.selectOption("#revisor", { label: e.beto.nombre });
  await page.click('form:has(#revisor) button[type=submit]');
  await expect(page.getByRole("cell", { name: e.beto.nombre })).toBeVisible({ timeout: 30_000 });

  // ------------------------------------------------------------ 2. dictamen
  await page.reload();
  await page.click('button:has-text("Empezar mi dictamen")');
  await page.waitForURL("**/panel/dictamen/**");

  expect(await page.content()).not.toContain(AUTOR);

  // Una tarjeta a medias no puede enviarse: es lo que hace que desvelarse
  // cueste algo. Se comprueba antes de rellenarla.
  await page.click('button:has-text("Enviar dictamen")');
  await expect(page.locator(".aviso").first()).toBeVisible();
  expect(await page.content()).not.toContain(AUTOR);

  // Rellenar entera: todas las puertas a "Sí" y todas las dimensiones a 3.
  // Se hace clic en la etiqueta y no en el radio: el radio está oculto a la
  // vista (opacity 0) y lo que se ve y se pulsa es su <label>, igual que hace
  // una persona.
  for (const grupo of await page.locator('.rubrica-fila:has(input[value="si"])').all()) {
    await grupo.locator('label:has(input[value="si"])').click();
  }
  for (const grupo of await page.locator('.rubrica-fila:has(input[value="3"])').all()) {
    await grupo.locator('label:has(input[value="3"])').click();
  }
  await page.fill("textarea[name=comentarios]", "Comentario de prueba.");
  await page.check("input[name=sin_conflicto]");

  await page.click('button:has-text("Enviar dictamen")');
  await expect(page.locator(".aviso--ok")).toBeVisible({ timeout: 30_000 });

  // ------------------------------------------------------- Ana ya ve al autor
  await page.goto(`/panel/envios/${e.envioId}`);
  expect(await page.content()).toContain(AUTOR);
  expect(await page.content()).toContain(e.correoAutor);

  await sale(page);

  // -------------------------------------------------- 3. Beto sigue ciego
  await entra(page, e.beto.correo);
  await page.goto(`/panel/envios/${e.envioId}`);

  // Está asignado y ve que el dictamen de Ana existe, con su puntaje. Lo que
  // no ve es al autor: el desvelado es por persona, no por envío.
  expect(await page.content()).toContain(e.ana.nombre);
  expect(await page.content()).not.toContain(AUTOR);
  expect(await page.content()).not.toContain(e.correoAutor);
  await expect(page.getByText("Oculta.")).toBeVisible();

  await sale(page);

  // ------------------------------------------------ 4. la decisión desvela
  await entra(page, e.ana.correo);
  await page.goto(`/panel/envios/${e.envioId}`);
  await page.selectOption("#decision", { index: 1 });
  await page.click('form:has(#decision) button[type=submit]');
  // Otra vez el formulario desaparece al tener éxito —la sección pasa a
  // mostrar la decisión grabada—, así que lo que se afirma es el resultado.
  await expect(page.getByText(new RegExp(`Grabada por ${e.ana.nombre}`))).toBeVisible({ timeout: 30_000 });

  await sale(page);

  await entra(page, e.beto.correo);
  await page.goto(`/panel/envios/${e.envioId}`);
  expect(await page.content()).toContain(AUTOR);
});

test("la cola nunca trae autoría, ni siquiera de lo ya decidido", async ({ page }) => {
  await entra(page, e.beto.correo);
  await page.goto("/panel");

  // `envios` no lleva PII, así que la cola hereda la ceguera sin lógica propia.
  // Esta prueba corre DESPUÉS de la anterior, con el envío ya decidido: aun
  // pudiendo verla, la cola no la pide.
  expect(await page.content()).not.toContain(AUTOR);
  expect(await page.content()).not.toContain(e.correoAutor);
});

test("sin sesión no se llega al panel", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(`/panel/envios/${e.envioId}`);
  await page.waitForURL("**/panel/entrar");
  expect(await page.content()).not.toContain(AUTOR);
});
