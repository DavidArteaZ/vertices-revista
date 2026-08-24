/**
 * Claves de la etapa 5. Igual que etapa4.mjs: se ejecuta una vez y deja
 * constancia de qué se añadió y por qué, en vez de editar a mano el JSON
 * generado.
 *
 *     node scripts/i18n/etapa5.mjs && npm run i18n:generar
 *
 * El panel NO lleva claves: es interno, va en español y vive fuera del
 * enrutado por idioma. Lo único que la etapa 5 manda al público es el aviso de
 * decisión, y ése sí tiene que salir en el idioma con el que el autor envió
 * (spec §10).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_WEB } from "./dicts.mjs";

const RUTA = path.join(DIR_WEB, "scripts/i18n/claves.json");
const claves = JSON.parse(readFileSync(RUTA, "utf8"));

const AGREGAR = {
  correo: {
    asunto_decision: "Hay una decisión sobre tu manuscrito — {folio}",
    // La etiqueta va tal cual la grabó el comité, sin traducir: es vocabulario
    // editorial del instrumento con el que se dictaminó, y traducirlo por
    // nuestra cuenta cambiaría el veredicto.
    el_comite_registro_decision:
      "El comité registró una decisión sobre «{titulo}»: {decision}.",
    puedes_consultarlo_cuando_quieras:
      "Puedes volver a consultar el estado de tu envío cuando quieras con tu folio y este correo.",
    gracias_por_enviar_a_vertices: "Gracias por enviar tu trabajo a Vértices.",
  },
};

for (const [espacio, entradas] of Object.entries(AGREGAR)) {
  claves[espacio] ??= {};
  for (const [clave, texto] of Object.entries(entradas)) {
    claves[espacio][clave] = texto;
  }
}

writeFileSync(RUTA, JSON.stringify(claves, null, 2) + "\n");
console.log("claves.json actualizado para la etapa 5");
