/**
 * Añade a claves.json lo que la etapa 4 necesita y quita lo que deja de ser
 * cierto. Se ejecuta una vez:
 *
 *     node scripts/i18n/etapa4.mjs && npm run i18n:generar
 *
 * claves.json dejó de ser una salida del codemod cuando la etapa 2 terminó:
 * ahora es la fuente. convertir.mjs fue una migración de un solo uso y volver
 * a correrlo borraría todo lo que se añada a mano después. Lo que se conserva
 * es la regla de generar.mjs, que sigue siendo la de siempre — sin traducción
 * legada, la cadena renderiza en español en los seis idiomas—, y por eso las
 * nueve etiquetas de tipo_pieza salen en español en todas partes: la spec ya
 * las clasifica como traducción nueva y no como migración (§11).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_WEB } from "./dicts.mjs";

const RUTA = path.join(DIR_WEB, "scripts/i18n/claves.json");
const claves = JSON.parse(readFileSync(RUTA, "utf8"));

// Lo que la etapa 4 vuelve falso: ya no hay folio de mentira ni pantalla
// desconectada, y las cinco opciones de "formato" las sustituyen los nueve
// tipos canónicos del catálogo (spec §8).
const QUITAR = {
  formularioenvio: [
    "vtx_2026_000",
    "el_registro_todavia_no_esta_conectado_esta_panta_558b",
    "paper_o_abstract_de_investigacion",
    "articulo_con_datos_o_visualizacion",
    "entrevista_o_articulo_de_opinion_verificado",
    "capsula_breve",
    "otro_formato",
  ],
};

const AGREGAR = {
  formularioenvio: {
    // Los nueve tipos de pieza de la hoja Catálogos. El value del <option>
    // sigue siendo el español canónico: es lo que el servidor resuelve contra
    // public.tipos_pieza, y por eso la base recibe lo mismo en cualquier
    // idioma.
    tipo_paper_investigacion: "Paper/Investigación",
    tipo_articulo: "Artículo",
    tipo_nota: "Nota",
    tipo_entrevista: "Entrevista",
    tipo_visualizacion: "Visualización",
    tipo_infografia: "Infografía",
    tipo_capsula: "Cápsula",
    tipo_cronica: "Crónica",
    tipo_resena: "Reseña",

    subiendo_archivos: "Subiendo archivos…",
    registrando_envio: "Registrando tu envío…",
    te_escribimos_un_acuse_a_tu_correo:
      "Te enviamos un acuse a tu correo con el folio y el enlace de consulta.",
  },

  avisos: {
    // El respaldo que inventaba un folio y mostraba éxito cuando el registro
    // fallaba (index.html:2172-2175) es el defecto 3 de la spec y desaparece.
    // Lo que lo sustituye tiene que decir dos cosas: que no se guardó, y que
    // lo escrito sigue ahí.
    no_pudimos_registrar_tu_envio:
      "No pudimos registrar tu envío. No se ha perdido nada de lo que escribiste: vuelve a intentarlo en un momento.",
    no_pudimos_subir_a: 'No pudimos subir "{a}". Vuelve a intentarlo.',
    demasiados_intentos:
      "Demasiados intentos desde esta conexión. Espera unos minutos y vuelve a intentarlo.",
    a_no_es_un_pdf_ni_un_documento_de_word:
      '"{a}" no es un .pdf ni un documento de Word por dentro, aunque lo parezca por el nombre.',
    entre_todos_los_archivos_se_pasan_de_50_mb:
      "Entre todos los archivos se pasan de 50 MB.",
    puedes_adjuntar_como_maximo_5_archivos: "Puedes adjuntar como máximo 5 archivos.",
    // Respuesta única para "correo equivocado" y "folio inexistente": la
    // consulta pública no debe poder usarse para averiguar si una dirección
    // envió algo (§13).
    no_encontramos_esa_combinacion_de_folio_y_correo:
      "No encontramos esa combinación de folio y correo.",
    no_pudimos_consultar_ahora: "No pudimos consultar ahora mismo. Inténtalo de nuevo.",
  },

  estadoenvio: {
    en_revision: "En revisión",
    decision_del_comite: "Decisión del comité",
    recibido_el_f: "Recibido el {f}",
  },

  // El acuse que Resend manda al autor, en el idioma con el que envió (§10).
  // Hoy sale en español en los seis porque no hay diccionario legado que lo
  // traduzca; el enrutado por idioma ya está puesto, así que traducirlo
  // después es rellenar los seis archivos y nada más.
  correo: {
    asunto_acuse: "Recibimos tu manuscrito — {folio}",
    hola_nombre: "Hola {nombre}:",
    registramos_tu_manuscrito_titulo:
      "Registramos tu manuscrito «{titulo}» en Revista Vértices.",
    tu_folio_es_folio:
      "Tu folio es {folio}. Guárdalo: con él y con este correo puedes consultar en qué etapa va tu pieza.",
    entra_a_dictaminacion:
      "Tu pieza entra ahora al proceso de dictaminación a doble ciego. Te escribiremos en cuanto el comité registre una decisión.",
    consultar_el_estado: "Consultar el estado de mi envío",
    firma: "Revista Vértices",
    no_respondas_a_este_correo:
      "Este mensaje es automático; para cualquier duda responde al correo del comité editorial.",
  },
};

for (const [espacio, lista] of Object.entries(QUITAR)) {
  for (const clave of lista) {
    if (clave in claves[espacio]) delete claves[espacio][clave];
  }
}

for (const [espacio, entradas] of Object.entries(AGREGAR)) {
  claves[espacio] ??= {};
  for (const [clave, texto] of Object.entries(entradas)) {
    claves[espacio][clave] = texto;
  }
}

writeFileSync(RUTA, JSON.stringify(claves, null, 2) + "\n");
console.log("claves.json actualizado para la etapa 4");
