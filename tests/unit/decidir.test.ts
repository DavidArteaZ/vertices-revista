import { describe, it, expect } from "vitest";
import { decidir } from "@/lib/dictamen/decidir";
import type { Respuestas, Rubrica } from "@/lib/dictamen/rubrica";
import rubricasJson from "@/lib/dictamen/rubricas.json";

/**
 * La matriz de pruebas de la spec §6.2, corrida contra las OCHO rúbricas
 * reales, no contra un instrumento de juguete.
 *
 * src/lib/dictamen/rubricas.json lo genera scripts/rubricas/generar-semillas.mjs
 * desde el mismo libro de Excel del que sale la migración de semillas, y la
 * suma de verificación que imprime ese script coincide con la que calcula
 * Postgres sobre lo sembrado (6449ec3aa78d89bd). Así que probar contra este
 * fixture es probar contra lo que está en la base.
 */

const RUBRICAS = rubricasJson as unknown as (Rubrica & { seccion: string; nivel: string })[];

// --------------------------------------------------------------- ayudantes

const criticas = (r: Rubrica) => r.dimensiones.filter((d) => d.esCritica);
const eliminatorias = (r: Rubrica) => r.puertas.filter((p) => p.esEliminatoria);

/** Todas las puertas en Sí y todas las dimensiones en 3: el caso perfecto. */
function todoBien(r: Rubrica): Respuestas {
  return {
    puertas: new Map(r.puertas.map((p) => [p.id, true])),
    puntajes: new Map(r.dimensiones.map((d) => [d.id, 3])),
  };
}

function conPuertas(base: Respuestas, cambios: Map<number, boolean | null>): Respuestas {
  const puertas = new Map(base.puertas);
  for (const [k, v] of cambios) puertas.set(k, v);
  return { ...base, puertas };
}

function sinPuerta(base: Respuestas, id: number): Respuestas {
  const puertas = new Map(base.puertas);
  puertas.delete(id);
  return { ...base, puertas };
}

function conPuntajes(base: Respuestas, cambios: Map<number, number | null>): Respuestas {
  const puntajes = new Map(base.puntajes);
  for (const [k, v] of cambios) puntajes.set(k, v);
  return { ...base, puntajes };
}

function sinDimension(base: Respuestas, id: number): Respuestas {
  const puntajes = new Map(base.puntajes);
  puntajes.delete(id);
  return { ...base, puntajes };
}

/**
 * Reparte calificaciones para que el puntaje sume exactamente `objetivo`,
 * manteniendo toda crítica en 2 o más para que no se dispare la regla 3.
 * Devuelve null si el objetivo no es alcanzable bajo esa restricción.
 */
function puntajeExacto(
  r: Rubrica,
  objetivo: number,
  excluir: ReadonlySet<number> = new Set(),
): Map<number, number> | null {
  const dims = r.dimensiones.filter((d) => !excluir.has(d.id));
  const valores = new Map(dims.map((d) => [d.id, d.esCritica ? 2 : 0]));
  const suma = () => dims.reduce((s, d) => s + valores.get(d.id)! * d.peso, 0);

  if (suma() > objetivo) return null;
  // Sube de uno en uno por la dimensión que quepa; los pesos son 1 o 2, así
  // que basta con probar de mayor a menor peso para no pasarse.
  const porPeso = [...dims].sort((a, b) => b.peso - a.peso);
  let guardia = 0;
  while (suma() < objetivo) {
    if (guardia++ > 500) return null;
    const cabe = porPeso.find(
      (d) => valores.get(d.id)! < 3 && suma() + d.peso <= objetivo,
    );
    if (!cabe) return null;
    valores.set(cabe.id, valores.get(cabe.id)! + 1);
  }
  return valores;
}

/** El decisionId que corresponde a un puntaje dentro de una variante. */
function esperadoEnBanda(r: Rubrica, variante: number, puntaje: number) {
  const b = r.bandas
    .filter((x) => x.variante === variante)
    .sort((a, z) => z.minPuntaje - a.minPuntaje)
    .find((x) => puntaje >= x.minPuntaje)!;
  return r.decisiones.find((d) => d.id === b.decisionId)!;
}

// ------------------------------------------------------------------ pruebas

it("hay ocho instrumentos", () => expect(RUBRICAS).toHaveLength(8));

for (const r of RUBRICAS) {
  describe(r.seccion, () => {
    const maximoPleno = r.dimensiones.reduce((s, d) => s + 3 * d.peso, 0);

    it("sin nada calificado queda pendiente, aunque las puertas fallen", () => {
      const res = decidir(r, {
        puertas: new Map(r.puertas.map((p) => [p.id, false])),
        puntajes: new Map(),
      });
      expect(res.motivo).toBe("pendiente");
      expect(res.decision.etiqueta).toBe(r.etiquetaPendiente);
      expect(res.puntaje).toBe(0);
    });

    it("todo perfecto da la banda más alta", () => {
      const res = decidir(r, todoBien(r));
      expect(res.motivo).toBe("banda");
      expect(res.puntaje).toBe(maximoPleno);
      expect(res.maximo).toBe(maximoPleno);
      expect(res.decision.esAceptante).toBe(true);
      expect(res.decision).toEqual(esperadoEnBanda(r, maximoPleno, maximoPleno));
    });

    // ------------------------------------------------------------- puertas
    for (const p of eliminatorias(r)) {
      it(`la puerta ★ "${p.etiqueta}" reprueba en No`, () => {
        const res = decidir(r, conPuertas(todoBien(r), new Map([[p.id, false]])));
        expect(res.motivo).toBe("falla_puerta");
        expect(res.puertasOk).toBe(false);
        expect(res.decision.etiqueta).toBe(r.etiquetaFallaPuerta);
        expect(res.decision.esFalla).toBe(true);
      });

      it(`la puerta ★ "${p.etiqueta}" reprueba sin contestar (fila ausente)`, () => {
        // U8 = IF(AND(F8="Sí"),"Sí","No"): una celda en blanco reprueba.
        const res = decidir(r, sinPuerta(todoBien(r), p.id));
        expect(res.motivo).toBe("falla_puerta");
        expect(res.decision.etiqueta).toBe(r.etiquetaFallaPuerta);
      });

      it(`la puerta ★ "${p.etiqueta}" reprueba en null`, () => {
        const res = decidir(r, conPuertas(todoBien(r), new Map([[p.id, null]])));
        expect(res.motivo).toBe("falla_puerta");
      });
    }

    it("las puertas que no son ★ no afectan el resultado", () => {
      const noEstrella = r.puertas.filter((p) => !p.esEliminatoria);
      if (noEstrella.length === 0) return;
      const res = decidir(
        r,
        conPuertas(todoBien(r), new Map(noEstrella.map((p) => [p.id, false]))),
      );
      expect(res.motivo).toBe("banda");
      expect(res.puertasOk).toBe(true);
    });

    // ------------------------------------------------------------ críticas
    for (const d of criticas(r)) {
      it(`la crítica ★ "${d.etiqueta}" reprueba en 1`, () => {
        const res = decidir(r, conPuntajes(todoBien(r), new Map([[d.id, 1]])));
        expect(res.motivo).toBe("falla_critico");
        expect(res.criticosOk).toBe(false);
        expect(res.decision.etiqueta).toBe(r.etiquetaFallaCritico);
      });

      it(`la crítica ★ "${d.etiqueta}" pasa en 2`, () => {
        const res = decidir(r, conPuntajes(todoBien(r), new Map([[d.id, 2]])));
        expect(res.criticosOk).toBe(true);
        expect(res.motivo).toBe("banda");
      });

      it(`la crítica ★ "${d.etiqueta}" reprueba sin calificar si hay otra calificada`, () => {
        // V8 evalúa la celda en blanco como 0 >= 2 → falso, en cuanto
        // COUNT(...) deja de ser cero.
        const res = decidir(r, sinDimension(todoBien(r), d.id));
        expect(res.motivo).toBe("falla_critico");
        expect(res.decision.etiqueta).toBe(r.etiquetaFallaCritico);
      });
    }

    it("la puerta gana a la crítica cuando fallan las dos", () => {
      const conAmbas = conPuntajes(
        conPuertas(todoBien(r), new Map(eliminatorias(r).map((p) => [p.id, false]))),
        new Map(criticas(r).map((d) => [d.id, 0])),
      );
      expect(decidir(r, conAmbas).motivo).toBe("falla_puerta");
    });

    // -------------------------------------------------------------- bandas
    const variantes = [...new Set(r.bandas.map((b) => b.variante))];
    for (const variante of variantes) {
      // Para la variante reducida hay que marcar N/A la dimensión que lo
      // permita; es lo que baja el máximo.
      const naDim = r.dimensiones.find((d) => d.permiteNa);
      const reducida = variante !== maximoPleno;
      const excluir = reducida && naDim ? new Set([naDim.id]) : new Set<number>();

      const umbrales = r.bandas
        .filter((b) => b.variante === variante)
        .map((b) => b.minPuntaje)
        .sort((a, b) => b - a);

      // Ambos bordes de cada banda: el mínimo exacto, y uno menos.
      const objetivos = [...new Set(umbrales.flatMap((m) => [m, m - 1]).filter((m) => m >= 0))];

      for (const objetivo of objetivos) {
        it(`/${variante}: un puntaje de ${objetivo} cae en su banda`, () => {
          const reparto = puntajeExacto(r, objetivo, excluir);
          if (!reparto) {
            // Con las críticas obligadas a 2 hay puntajes inalcanzables. Se
            // declara en vez de callarse: un test que no corre no es un test.
            expect(objetivo).toBeLessThan(
              criticas(r).reduce((s, d) => s + 2 * d.peso, 0),
            );
            return;
          }
          const puntajes = new Map<number, number | null>(reparto);
          if (reducida && naDim) puntajes.set(naDim.id, null);

          const res = decidir(r, { puertas: todoBien(r).puertas, puntajes });
          expect(res.maximo).toBe(variante);
          expect(res.puntaje).toBe(objetivo);
          expect(res.motivo).toBe("banda");
          expect(res.decision).toEqual(esperadoEnBanda(r, variante, objetivo));
        });
      }
    }

    it("rechaza N/A en una dimensión que no lo admite", () => {
      const sinNa = r.dimensiones.find((d) => !d.permiteNa)!;
      expect(() =>
        decidir(r, conPuntajes(todoBien(r), new Map([[sinNa.id, null]]))),
      ).toThrow(/no admite N\/A/);
    });
  });
}

// -------------------------------------------------- casos propios del libro

describe("aritmética del peso ×2 en Apertura editorial", () => {
  const r = RUBRICAS.find((x) => x.seccion.includes("Apertura"))!;
  const critica = r.dimensiones.find((d) => d.esCritica)!;

  it("la crítica pesa doble: S8 = J8*2 + K8 + L8 + M8", () => {
    expect(critica.peso).toBe(2);
    const puntajes = new Map<number, number | null>(r.dimensiones.map((d) => [d.id, 1]));
    puntajes.set(critica.id, 3); // 3*2 + 1 + 1 + 1
    const res = decidir(r, { puertas: todoBien(r).puertas, puntajes });
    expect(res.puntaje).toBe(9);
    expect(res.maximo).toBe(15);
  });
});

describe("N/A en Datanomics", () => {
  const r = RUBRICAS.find((x) => x.seccion.includes("Datanomics"))!;
  const na = r.dimensiones.find((d) => d.permiteNa)!;

  it("es la única dimensión del libro que admite N/A", () => {
    const todas = RUBRICAS.flatMap((x) => x.dimensiones).filter((d) => d.permiteNa);
    expect(todas).toHaveLength(1);
    expect(na.etiqueta).toContain("how-to");
  });

  it("marcarla N/A baja el máximo de 15 a 12", () => {
    const puntajes = new Map<number, number | null>(r.dimensiones.map((d) => [d.id, 3]));
    puntajes.set(na.id, null);
    const res = decidir(r, { puertas: todoBien(r).puertas, puntajes });
    expect(res.maximo).toBe(12);
    expect(res.puntaje).toBe(12);
  });

  it("y cambia de juego de bandas: 10 es Publicable en /12 y no en /15", () => {
    const base = new Map<number, number | null>([
      [r.dimensiones[0].id, 3], [r.dimensiones[1].id, 2],
      [r.dimensiones[2].id, 3], [r.dimensiones[3].id, 2],
    ]);

    const conNa = new Map(base);
    conNa.set(na.id, null);
    const reducida = decidir(r, { puertas: todoBien(r).puertas, puntajes: conNa });
    expect(reducida.maximo).toBe(12);
    expect(reducida.puntaje).toBe(10);
    expect(reducida.decision.etiqueta).toBe("Publicable");

    const conCero = new Map(base);
    conCero.set(na.id, 0);
    const plena = decidir(r, { puertas: todoBien(r).puertas, puntajes: conCero });
    expect(plena.maximo).toBe(15);
    expect(plena.puntaje).toBe(10);
    expect(plena.decision.etiqueta).toBe("Publicable con ajustes menores");
  });

  it("calificar SÓLO la dimensión N/A deja la pieza pendiente", () => {
    // COUNT ignora el texto "N/A", así que COUNT(K8:O8) sigue siendo 0.
    const res = decidir(r, {
      puertas: todoBien(r).puertas,
      puntajes: new Map([[na.id, null]]),
    });
    expect(res.motivo).toBe("pendiente");
  });
});

describe("los tres vocabularios", () => {
  it("Miradas Económicas habla distinto que las otras siete", () => {
    const miradas = RUBRICAS.find((x) => x.nivel === "A")!;
    expect(miradas.etiquetaFallaPuerta).toBe("No aceptable (revisar puertas ★)");
    expect(miradas.etiquetaFallaCritico).toBe("No aceptable (crítico < 2)");
    expect(miradas.decisiones.map((d) => d.etiqueta)).toContain("Rechazado");
    // "Requiere reelaboración" es un veredicto de Nivel C que en Nivel A no
    // existe. Confundirlos sería cambiar el resultado editorial.
    expect(miradas.decisiones.map((d) => d.etiqueta)).not.toContain("Requiere reelaboración");

    for (const otra of RUBRICAS.filter((x) => x.nivel !== "A")) {
      expect(otra.etiquetaFallaPuerta).toBe("No publicable (falla puerta ★)");
      expect(otra.etiquetaFallaCritico).toBe("Requiere reelaboración (crítico < 2)");
      expect(otra.decisiones.map((d) => d.etiqueta)).not.toContain("Aceptado");
    }
  });

  it("sólo las dos primeras bandas de cada vocabulario aceptan", () => {
    for (const r of RUBRICAS) {
      const aceptantes = r.decisiones.filter((d) => d.esAceptante).map((d) => d.etiqueta);
      expect(aceptantes).toHaveLength(2);
    }
  });
});

describe("la versión fijada sobrevive a un cambio de la rúbrica viva", () => {
  it("el mismo dictamen contra la rúbrica vieja mantiene su veredicto", () => {
    const vieja = RUBRICAS.find((x) => x.seccion.includes("Sabías"))!;
    const respuestas: Respuestas = {
      puertas: new Map(vieja.puertas.map((p) => [p.id, true])),
      puntajes: new Map([
        [vieja.dimensiones[0].id, 3], [vieja.dimensiones[1].id, 2],
        [vieja.dimensiones[2].id, 2], [vieja.dimensiones[3].id, 3],
      ]),
    };
    const antes = decidir(vieja, respuestas);
    expect(antes.puntaje).toBe(10);
    expect(antes.decision.etiqueta).toBe("Publicable");

    // El comité endurece la rúbrica: ahora Publicable pide 11.
    const nueva: Rubrica = {
      ...vieja,
      id: vieja.id + 100,
      bandas: vieja.bandas.map((b) => (b.minPuntaje === 10 ? { ...b, minPuntaje: 11 } : b)),
    };
    expect(decidir(nueva, respuestas).decision.etiqueta).toBe("Publicable con ajustes menores");
    // Y el dictamen viejo, que apunta a la versión vieja, no se mueve.
    expect(decidir(vieja, respuestas).decision.etiqueta).toBe("Publicable");
  });
});
