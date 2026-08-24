/**
 * Genera supabase/migrations/*_semillas.sql desde tres fuentes:
 *
 *   · scripts/rubricas/extraidas.json — los ocho instrumentos, sacados del
 *     libro de Excel con openpyxl: puertas, dimensiones, pesos, cuáles son ★
 *     y cuál admite N/A, leídos de las validaciones de datos de cada hoja.
 *   · src/lib/datos/secciones.ts y temas.ts — los nombres de interfaz y las
 *     descripciones que ya muestra el sitio.
 *   · BANDAS, aquí abajo — los umbrales, transcritos a mano de la fórmula W8
 *     de cada hoja y comprobados contra el texto de la fila A2.
 *
 * Se genera en vez de escribirse a mano porque son ocho instrumentos con 31
 * puertas y 39 dimensiones entre todos, y porque cualquier errata silenciosa
 * cambiaría un veredicto editorial.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(AQUI, "../..");
const RAIZ = path.resolve(WEB, "..");

const cita = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const slug = (t) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
   .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- catálogos

const ts = (f) => readFileSync(path.join(WEB, "src/lib/datos", f), "utf8");

const TEMAS = [...ts("temas.ts").matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const SECCIONES_APP = [...ts("secciones.ts").matchAll(
  /\{\s*label:\s*"([^"]+)"[\s\S]*?desc:\s*"([^"]+)"\s*\}/g,
)].map((m) => ({ display: m[1], desc: m[2] }));

/** Hoja Catálogos del libro: la forma canónica y el nivel de cada sección. */
const CANONICAS = [
  ["1 · Apertura editorial", "C"],
  ["2 · Datanomics", "B"],
  ["3 · La Voz de la Experiencia", "C"],
  ["4 · Miradas Económicas", "A"],
  ["5 · Horizonte Global", "B"],
  ["6 · ¿Sabías que…?", "C"],
  ["7 · Capital Social", "C"],
  ["8 · Excelencia en Acción", "C"],
];

/** Hoja Catálogos: los nueve tipos de pieza. */
const TIPOS = [
  "Paper/Investigación", "Artículo", "Nota", "Entrevista", "Visualización",
  "Infografía", "Cápsula", "Crónica", "Reseña",
];

// ------------------------------------------------------------------- bandas
//
// Transcritas de la fórmula W8 de cada hoja. `variante` es el máximo al que
// aplican; sólo Datanomics tiene dos, porque calificar el how-to como N/A baja
// su máximo de 15 a 12 y cambia el juego entero de umbrales.
const NIVEL_C_B = ["Publicable", "Publicable con ajustes menores", "Requiere reelaboración", "No publicable en este número"];
const NIVEL_A   = ["Aceptado", "Aceptado con revisiones menores", "Revisiones mayores", "Rechazado"];

const BANDAS = {
  "1. Apertura editorial":       { etiquetas: NIVEL_C_B, variantes: { 15: [12, 9, 6, 0] } },
  "2. Datanomics":               { etiquetas: NIVEL_C_B, variantes: { 15: [12, 9, 6, 0], 12: [10, 7, 5, 0] } },
  "3. La Voz de la Experiencia": { etiquetas: NIVEL_C_B, variantes: { 15: [12, 9, 6, 0] } },
  "4. Miradas Económicas":       { etiquetas: NIVEL_A,   variantes: { 21: [17, 14, 9, 0] } },
  "5. Horizonte Global":         { etiquetas: NIVEL_C_B, variantes: { 18: [14, 11, 7, 0] } },
  "6. Sabías que":               { etiquetas: NIVEL_C_B, variantes: { 12: [10, 7, 5, 0] } },
  "7. Capital Social":           { etiquetas: NIVEL_C_B, variantes: { 12: [10, 7, 5, 0] } },
  "8. Excelencia en Acción":     { etiquetas: NIVEL_C_B, variantes: { 12: [10, 7, 5, 0] } },
};

/** Sólo las dos primeras bandas de cada vocabulario permiten publicar. */
const ACEPTANTES = new Set([NIVEL_C_B[0], NIVEL_C_B[1], NIVEL_A[0], NIVEL_A[1]]);

/** Etiquetas de falla, verificadas contra W8. Miradas habla distinto. */
const FALLAS = {
  A: { puerta: "No aceptable (revisar puertas ★)", critico: "No aceptable (crítico < 2)" },
  otros: { puerta: "No publicable (falla puerta ★)", critico: "Requiere reelaboración (crítico < 2)" },
};
const PENDIENTE = "Pendiente de dictamen";

// ------------------------------------------------------------------- salida

const rubricas = JSON.parse(readFileSync(path.join(AQUI, "extraidas.json"), "utf8"));
const L = [];
const w = (s = "") => L.push(s);

w("-- GENERADO por scripts/rubricas/generar-semillas.mjs. No editar a mano:");
w("-- vuelve a generarse desde el libro de Excel y estos cambios se perderían.");
w("--");
w("-- Semillas de referencia y de las ocho rúbricas (spec §5.1 y §6.1).");
w();

// secciones
w("insert into public.secciones (numero, nombre_canonico, nombre_display, slug, nivel, descripcion, orden, es_asignable, publica) values");
const filasSecc = CANONICAS.map(([canon, nivel], i) => {
  const app = SECCIONES_APP[i];
  return `  (${i + 1}, ${cita(canon)}, ${cita(app.display)}, ${cita(slug(app.display))}, ${cita(nivel)}, ${cita(app.desc)}, ${i + 1}, true, true)`;
});
// "Por asignar" es el destino de "Aún no lo decido" en el formulario. Sin
// nivel y no asignable: una pieza aquí no puede ir a dictamen hasta que el
// comité la triage. Es lo que impide repetir el registro huérfano del libro.
filasSecc.push(`  (null, 'Por asignar', 'Por asignar', 'por-asignar', null, 'Piezas cuya sección todavía no decide el comité. No pueden asignarse a dictamen hasta triaje.', 99, false, false)`);
w(filasSecc.join(",\n") + ";");
w();

// temas
w("insert into public.temas (nombre, slug, orden) values");
w([...TEMAS, "Otro tema"].map((t, i) => `  (${cita(t)}, ${cita(slug(t))}, ${i + 1})`).join(",\n") + ";");
w();

// tipos de pieza
w("insert into public.tipos_pieza (nombre, orden) values");
w(TIPOS.map((t, i) => `  (${cita(t)}, ${i + 1})`).join(",\n") + ";");
w();

// Rúbricas: los datos van en un literal jsonb y la lógica de inserción se
// escribe una sola vez. Ocho bloques repetidos de INSERT serían cinco veces
// más largos y esconderían la estructura, que es lo único que importa
// revisar aquí.
const spec = rubricas.map((r) => {
  const cfg = BANDAS[r.hoja];
  const falla = r.nivel === "A" ? FALLAS.A : FALLAS.otros;
  return {
    seccion: CANONICAS[Number(r.hoja[0]) - 1][0],
    falla_puerta: falla.puerta,
    falla_critico: falla.critico,
    puertas: r.puertas.map((p) => [p.etiqueta, p.eliminatoria]),
    dimensiones: r.dimensiones.map((d) => [d.etiqueta, d.critica, d.peso, d.permite_na]),
    decisiones: cfg.etiquetas.map((e) => [e, ACEPTANTES.has(e)]),
    // [variante, [min de cada banda, en el orden de `decisiones`]]
    bandas: Object.entries(cfg.variantes).map(([v, mins]) => [Number(v), mins]),
  };
});

w("-- Los ocho instrumentos. Las etiquetas salen tal cual de la fila 7 de cada");
w("-- hoja; ★ marca puerta eliminatoria o dimensión crítica, y es la misma");
w("-- marca que usa el libro.");
w("do $$");
w("declare");
// Una línea por instrumento: compacto pero todavía legible en la revisión.
w(`  spec jsonb := ${cita("[\n" + spec.map((s) => JSON.stringify(s)).join(",\n") + "\n]")}::jsonb;`);
w("  r jsonb;");
w("  x jsonb;");
w("  b jsonb;");
w("  i int;");
w("  v_version bigint;");
w("  v_seccion bigint;");
w("begin");
w("  for r in select value from jsonb_array_elements(spec) loop");
w("    select id into strict v_seccion");
w("      from public.secciones where nombre_canonico = r->>'seccion';");
w();
w("    insert into public.rubrica_versiones");
w("      (seccion_id, version, vigente, etiqueta_falla_puerta, etiqueta_falla_critico, etiqueta_pendiente)");
w(`    values (v_seccion, 1, true, r->>'falla_puerta', r->>'falla_critico', ${cita(PENDIENTE)})`);
w("    returning id into v_version;");
w();
w("    i := 0;");
w("    for x in select value from jsonb_array_elements(r->'puertas') loop");
w("      i := i + 1;");
w("      insert into public.rubrica_puertas (rubrica_version_id, orden, etiqueta, es_eliminatoria)");
w("      values (v_version, i, x->>0, (x->>1)::boolean);");
w("    end loop;");
w();
w("    i := 0;");
w("    for x in select value from jsonb_array_elements(r->'dimensiones') loop");
w("      i := i + 1;");
w("      insert into public.rubrica_dimensiones");
w("        (rubrica_version_id, orden, etiqueta, es_critica, peso, permite_na)");
w("      values (v_version, i, x->>0, (x->>1)::boolean, (x->>2)::smallint, (x->>3)::boolean);");
w("    end loop;");
w();
w("    i := 0;");
w("    for x in select value from jsonb_array_elements(r->'decisiones') loop");
w("      i := i + 1;");
w("      insert into public.decisiones (rubrica_version_id, orden, etiqueta, es_aceptante, es_falla)");
w("      values (v_version, i, x->>0, (x->>1)::boolean, false);");
w("    end loop;");
w();
w("    -- Las dos fallas y el pendiente también son decisiones: la instantánea");
w("    -- del dictamen apunta a una fila de esta tabla, gane o pierda la pieza.");
w("    insert into public.decisiones (rubrica_version_id, orden, etiqueta, es_aceptante, es_falla) values");
w("      (v_version, 90, r->>'falla_puerta', false, true),");
w("      (v_version, 91, r->>'falla_critico', false, true),");
w(`      (v_version, 99, ${cita(PENDIENTE)}, false, false);`);
w();
w("    for b in select value from jsonb_array_elements(r->'bandas') loop");
w("      for i in 0 .. jsonb_array_length(b->1) - 1 loop");
w("        insert into public.bandas_decision (rubrica_version_id, variante, min_puntaje, decision_id)");
w("        select v_version, (b->>0)::smallint, (b->1->>i)::smallint, d.id");
w("          from public.decisiones d");
w("         where d.rubrica_version_id = v_version");
w("           and d.etiqueta = r->'decisiones'->i->>0;");
w("      end loop;");
w("    end loop;");
w("  end loop;");
w("end $$;");

const salida = path.join(RAIZ, "supabase/migrations/20260821120600_semillas.sql");
writeFileSync(salida, L.join("\n") + "\n");
console.log(`escrito ${path.relative(RAIZ, salida)} — ${L.length} líneas`);

// ------------------------------------------------------- fixture de pruebas
//
// La misma estructura, en la forma que consume el motor de decisión. Los ids
// son locales y correlativos: al motor no le importan, y así el fixture no
// depende de qué ids repartió Postgres. La correspondencia con lo que está
// realmente sembrado se comprueba aparte, con la suma de verificación que
// imprime este script.
let nP = 0, nD = 0, nDec = 0;
const fixture = rubricas.map((r) => {
  const cfg = BANDAS[r.hoja];
  const falla = r.nivel === "A" ? FALLAS.A : FALLAS.otros;
  const puertas = r.puertas.map((p) => ({
    id: ++nP, etiqueta: p.etiqueta, esEliminatoria: p.eliminatoria,
  }));
  const dimensiones = r.dimensiones.map((d) => ({
    id: ++nD, etiqueta: d.etiqueta, esCritica: d.critica, peso: d.peso, permiteNa: d.permite_na,
  }));
  const decisiones = [
    ...cfg.etiquetas.map((e) => ({ id: ++nDec, etiqueta: e, esAceptante: ACEPTANTES.has(e), esFalla: false })),
    { id: ++nDec, etiqueta: falla.puerta, esAceptante: false, esFalla: true },
    { id: ++nDec, etiqueta: falla.critico, esAceptante: false, esFalla: true },
    { id: ++nDec, etiqueta: PENDIENTE, esAceptante: false, esFalla: false },
  ];
  const bandas = Object.entries(cfg.variantes).flatMap(([variante, mins]) =>
    mins.map((min, i) => ({
      variante: Number(variante),
      minPuntaje: min,
      decisionId: decisiones[i].id,
    })),
  );
  return {
    id: Number(r.hoja[0]),
    seccion: CANONICAS[Number(r.hoja[0]) - 1][0],
    nivel: r.nivel,
    puertas, dimensiones, decisiones, bandas,
    etiquetaFallaPuerta: falla.puerta,
    etiquetaFallaCritico: falla.critico,
    etiquetaPendiente: PENDIENTE,
  };
});

const rutaFixture = path.join(WEB, "src/lib/dictamen/rubricas.json");
writeFileSync(rutaFixture, JSON.stringify(fixture, null, 2) + "\n");
console.log(`escrito ${path.relative(RAIZ, rutaFixture)}`);

// Suma de verificación sobre lo que define el veredicto: etiquetas, orden,
// banderas, pesos y umbrales. Sirve para comprobar contra la base sin volcarla.
import { createHash } from "node:crypto";
const canonico = fixture.map((f) => [
  f.seccion,
  f.etiquetaFallaPuerta, f.etiquetaFallaCritico, f.etiquetaPendiente,
  f.puertas.map((p) => `${p.etiqueta}|${p.esEliminatoria}`).join("~"),
  f.dimensiones.map((d) => `${d.etiqueta}|${d.esCritica}|${d.peso}|${d.permiteNa}`).join("~"),
  f.decisiones.map((d) => `${d.etiqueta}|${d.esAceptante}|${d.esFalla}`).join("~"),
  f.bandas.map((b) => `${b.variante}|${b.minPuntaje}`).sort().join("~"),
].join("§")).join("\n");
console.log("suma de verificación:", createHash("sha256").update(canonico).digest("hex").slice(0, 16));
console.log(`  ${CANONICAS.length + 1} secciones, ${TEMAS.length + 1} temas, ${TIPOS.length} tipos`);
for (const r of rubricas) {
  console.log(`  ${r.hoja}: ${r.puertas.length} puertas, ${r.dimensiones.length} dimensiones`);
}
