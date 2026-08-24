export type Seccion = {
  label: string;
  x: number;
  y: number;
  z: number;
  imp: number;
  side?: "above" | "below";
  desc: string;
};

/** 8 secciones en su flujo narrativo, con descripción para la ficha. index.html:1009-1033 */
export const SECTIONS: readonly Seccion[] = [
  { label: "Apertura Editorial",       x: -1.48, y:  0.06, z:  0.12, imp: 1.35,
    desc: "La carta que abre cada número: qué encontrarás, por qué existe la revista y el estándar de rigor que la sostiene." },
  { label: "Datanomics",               x: -0.92, y: -0.62, z: -0.16, imp: 1.10,
    desc: "Visualizaciones e infografías sobre fenómenos económicos, con metodología clara y herramientas replicables (Python, R, Excel, SQL)." },
  { label: "La Voz de la Experiencia", x: -0.76, y:  0.60, z:  0.18, imp: 1.10,
    desc: "Conversaciones con economistas en activo: cómo se piensa y se trabaja en el mundo real, con consejos de carrera accionables." },
  { label: "Miradas Económicas",       x: -0.02, y: -0.06, z:  0.00, imp: 2.10, side: "below",
    desc: "El núcleo académico: investigaciones y papers dictaminados a doble ciego, con acceso al documento completo." },
  { label: "Horizonte Global",         x:  0.56, y: -0.66, z:  0.16, imp: 1.10,
    desc: "La economía internacional en lenguaje accesible: cómo un suceso global se traduce en inflación, tipo de cambio y tasas en México." },
  { label: "¿Sabías Qué?",             x:  0.74, y:  0.58, z: -0.18, imp: 1.00,
    desc: "Cápsulas breves y visuales: datos curiosos sobre economía, economistas e historia económica." },
  { label: "Capital Social",           x:  1.34, y: -0.48, z:  0.06, imp: 1.15,
    desc: "La vida de la comunidad: foros, congresos, estancias y las historias detrás de la facultad." },
  { label: "Excelencia en Acción",     x:  1.50, y:  0.38, z: -0.10, imp: 1.15,
    desc: "Reconocimiento a los logros académicos y profesionales de la comunidad de Economía." },
];

export const SEC_EDGES: readonly [number, number][] = [
  [0, 1], [0, 2], [1, 2],
  [1, 3], [2, 3],
  [3, 4], [3, 5], [4, 5],
  [4, 6], [5, 7], [6, 7], [4, 7],
];
